import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { COMMITTED_SST_SCENARIOS } from './catalog.js';
import { renderScenarioReportMarkdown, renderTerminalSummary } from './report.js';
import { sstValidationScenarioSchema, type SstValidationScenario } from './schema.js';
import { validateScenarioCatalog } from './validation.js';

type Arguments = { scenarioId?: string; inputPath?: string; help: boolean };

function parseArguments(values: readonly string[]): Arguments {
  const parsed: Arguments = { help: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--help' || value === '-h') {
      parsed.help = true;
      continue;
    }
    if (value === '--scenario') {
      const scenarioId = values[index + 1];
      if (!scenarioId) throw new Error('--scenario requires an id');
      parsed.scenarioId = scenarioId;
      index += 1;
      continue;
    }
    if (value === '--input') {
      const inputPath = values[index + 1];
      if (!inputPath) throw new Error('--input requires a JSON file or directory');
      parsed.inputPath = inputPath;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
}

function parseJsonFile(path: string): SstValidationScenario[] {
  if (extname(path).toLowerCase() !== '.json') {
    throw new Error(`External scenario input must be JSON, not executable content: ${path}`);
  }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const inputs = Array.isArray(parsed) ? parsed : [parsed];
  return inputs.map((input) => sstValidationScenarioSchema.parse(input));
}

function loadExternalScenarios(path: string): SstValidationScenario[] {
  const info = statSync(path);
  if (info.isFile()) return parseJsonFile(path);
  if (!info.isDirectory()) throw new Error(`Scenario input is not a file or directory: ${path}`);
  const entries = readdirSync(path, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const regularFiles = entries.filter((entry) => entry.isFile());
  const nonJson = regularFiles.filter((entry) => extname(entry.name).toLowerCase() !== '.json');
  if (nonJson.length > 0) {
    throw new Error(
      `Scenario directories may contain JSON only; rejected: ${nonJson.map(({ name }) => name).join(', ')}`,
    );
  }
  return regularFiles.flatMap((entry) => parseJsonFile(join(path, entry.name)));
}

function main() {
  const args = parseArguments(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(
      'Usage: pnpm validate:sst-scenarios [--scenario EC_DEMO_ID] [--input file-or-directory]\n',
    );
    return;
  }

  const repositoryRoot = resolve(__dirname, '../../..');
  const invocationRoot = process.env.INIT_CWD ?? repositoryRoot;
  const externalPath = args.inputPath
    ? isAbsolute(args.inputPath)
      ? args.inputPath
      : resolve(invocationRoot, args.inputPath)
    : undefined;
  const sourceScenarios = externalPath
    ? loadExternalScenarios(externalPath)
    : [...COMMITTED_SST_SCENARIOS];
  const selectedScenarios = args.scenarioId
    ? sourceScenarios.filter(({ id }) => id === args.scenarioId)
    : sourceScenarios;
  if (args.scenarioId && selectedScenarios.length !== 1) {
    throw new Error(`Scenario not found or not unique: ${args.scenarioId}`);
  }

  const report = validateScenarioCatalog(selectedScenarios, {
    requireFullCatalog: !externalPath && !args.scenarioId,
  });
  const containsPrivateCase = selectedScenarios.some(
    ({ scenarioKind }) => scenarioKind === 'PSEUDONYMIZED_EXPERT_CASE',
  );
  const outputDirectory = containsPrivateCase
    ? join(tmpdir(), 'sst-intelligence-private-scenario-reports')
    : join(repositoryRoot, '.artifacts', 'applicability-scenarios');
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outputDirectory, 'report.md'), renderScenarioReportMarkdown(report));
  process.stdout.write(`${renderTerminalSummary(report)}\nReports: ${outputDirectory}\n`);
  if (!report.overallPass) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
