import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');
const webRoot = fileURLToPath(new URL('..', import.meta.url));
const serialFlags = ['--workers=1', '--retries=0', '--repeat-each=1', '--max-failures=1'];
const filters = process.argv.slice(2);
assert(
  filters.every((filter) => !filter.startsWith('-')),
  'Only test-file filters are accepted',
);
// Discovery runs no tests or servers. It is the authoritative coverage inventory.
const discovery = spawnSync(
  process.execPath,
  [cli, 'test', ...filters, '--list', '--reporter=json'],
  {
    cwd: webRoot,
    encoding: 'utf8',
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: '', PLAYWRIGHT_JSON_OUTPUT_FILE: '' },
  },
);
assert.equal(discovery.status, 0, discovery.stderr);
const inventory = JSON.parse(discovery.stdout);
function specs(suites) {
  return suites.flatMap((suite) => [...suite.specs, ...specs(suite.suites ?? [])]);
}
const planned = specs(inventory.suites);
assert(planned.length > 0, 'No E2E tests discovered');
const files = [...new Set(planned.map((spec) => spec.file))].sort();
const completed = new Set();
let executed = 0;

for (const [index, file] of files.entries()) {
  const directory = join(webRoot, 'test-results', 'batches', file);
  await mkdir(directory, { recursive: true });
  const reportFile = join(directory, 'report.json');
  const selected = planned.filter((spec) => spec.file === file);
  console.log(
    `E2E_BATCH ${index + 1}/${files.length}: ${file} (${selected.length} tests; fresh API processes; real throttling)`,
  );
  // Playwright owns and stops every server before this returns. Reuse is forbidden
  // in the config, so a live process from outside the batch fails instead of leaking state.
  const result = spawnSync(
    process.execPath,
    [
      cli,
      'test',
      file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ...serialFlags,
      `--output=${join(directory, 'artifacts')}`,
      `--reporter=${process.env.CI ? 'github' : 'list'},json`,
    ],
    {
      cwd: webRoot,
      stdio: 'inherit',
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile },
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  const report = JSON.parse(await readFile(reportFile, 'utf8'));
  assert.equal(report.errors.length, 0, 'Unexpected Playwright error');
  assert.deepEqual(
    specs(report.suites)
      .map((spec) => spec.id)
      .sort(),
    selected.map((spec) => spec.id).sort(),
  );
  for (const spec of specs(report.suites)) {
    assert(!completed.has(spec.id), 'E2E test executed in more than one batch');
    assert.equal(spec.tests.length, 1, 'Expected the single Chromium project');
    const test = spec.tests[0];
    assert.equal(test.expectedStatus, 'passed');
    assert.equal(test.status, 'expected');
    assert.equal(test.results.length, 1, 'No retries or repetitions allowed');
    assert.equal(test.results[0].retry, 0);
    assert.equal(test.results[0].status, 'passed');
    completed.add(spec.id);
    executed += 1;
  }
}
assert.equal(completed.size, planned.length, 'Not all discovered tests executed');
console.log(
  `E2E_TOTAL: ${executed}/${planned.length} passed; ${files.length} serial batches; workers=1; retries=0; retried=0`,
);
