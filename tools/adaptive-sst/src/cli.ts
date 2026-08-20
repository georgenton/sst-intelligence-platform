import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateAdaptiveScenarios } from './validation.js';

const report = validateAdaptiveScenarios();
const root = resolve(__dirname, '../../..');
const directory = resolve(root, '.artifacts/adaptive-sst');
mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  resolve(directory, 'report.md'),
  `# Adaptive SST validation\n\n${report.outcomes
    .map((outcome) => `- ${outcome.id}: ${Object.values(outcome).every(Boolean) ? 'PASS' : 'FAIL'}`)
    .join('\n')}\n`,
);
process.stdout.write(
  `Adaptive SST: ${report.overallPass ? 'PASS' : 'FAIL'} · ${report.scenarioCount} escenarios\nArtifacts: ${directory}\n`,
);
process.exitCode = report.overallPass ? 0 : 1;
