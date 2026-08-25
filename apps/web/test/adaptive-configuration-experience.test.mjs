import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';
import ts from 'typescript';

function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  Function('exports', transpiled)(exports);
  return exports;
}

const experience = load('../lib/adaptive-configuration-experience.ts');

test('adaptive write policy remains owner/admin/manager only', () => {
  assert.equal(experience.canManageAdaptiveConfiguration('ORG_OWNER'), true);
  assert.equal(experience.canManageAdaptiveConfiguration('ORG_ADMIN'), true);
  assert.equal(experience.canManageAdaptiveConfiguration('SST_MANAGER'), true);
  assert.equal(experience.canManageAdaptiveConfiguration('SST_TECHNICIAN'), false);
  assert.equal(experience.canManageAdaptiveConfiguration('CONSULTANT'), false);
  assert.equal(experience.canManageAdaptiveConfiguration('VIEWER'), false);
});

test('copy keeps proposal, depth and current state semantically separate', () => {
  assert.match(experience.ADAPTIVE_DEMO_NOTICE, /reglas sintéticas de demostración/i);
  assert.match(experience.ADAPTIVE_DEMO_NOTICE, /no representa.*normativa ecuatoriana/i);
  assert.equal(experience.adaptiveDepthLabel.TECHNICAL, 'Técnico');
  assert.deepEqual(
    experience.adaptiveCurrentStateOptions.map(([value]) => value),
    [
      'UNKNOWN',
      'NOT_IMPLEMENTED',
      'PLANNED',
      'IN_PROGRESS',
      'PARTIALLY_IMPLEMENTED',
      'IMPLEMENTED',
    ],
  );
});

test('frontend component delegates reasoning and preserves safe evidence rendering', () => {
  const ui = readFileSync(
    new URL('../components/adaptive-configuration-ui.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(ui, /evaluateAdaptiveConfiguration|statePrecedence|depthPrecedence/);
  assert.match(ui, /target="_blank"/);
  assert.match(ui, /rel="noopener noreferrer"/);
  assert.match(ui, /Información proporcionada por la empresa; aún no ha sido verificada/);
  assert.doesNotMatch(ui, /porcentaje de cumplimiento|puntaje de cumplimiento/i);
});
