import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const adaptiveUi = readFileSync(
  new URL('../components/adaptive-field-intelligence-ui.tsx', import.meta.url),
  'utf8',
);
const observationsUi = readFileSync(
  new URL('../components/safety-observations-ui.tsx', import.meta.url),
  'utf8',
);

test('uses tenant source selectors and keeps implemented evidence informational', () => {
  assert.match(adaptiveUi, /Fuente canónica/);
  assert.doesNotMatch(adaptiveUi, /ID exacto del origen/);
  assert.match(adaptiveUi, /IMPLEMENTED_EVIDENCE_AVAILABLE/);
  assert.match(adaptiveUi, /Estado informativo: no genera trabajo del Plan Operativo/);
});

test('shows scoped profile provenance and canonical evidence labels', () => {
  assert.match(adaptiveUi, /Alcance:/);
  assert.match(adaptiveUi, /Procedencia:/);
  assert.match(adaptiveUi, /evidenceReference\.label/);
  assert.match(adaptiveUi, /Centro no disponible/);
});

test('a failed optional evidence request retries evidence without recreating the observation', () => {
  assert.match(observationsUi, /Observación registrada; la evidencia no pudo guardarse/);
  assert.match(observationsUi, /Reintentar solo la evidencia/);
  assert.match(observationsUi, /activePendingEvidence\.observationId}\/evidence/);
  assert.match(
    observationsUi,
    /disabled=\{create\.isPending \|\| Boolean\(activePendingEvidence\)\}/,
  );
});

test('search navigation distinguishes record detail from module roots', () => {
  assert.match(adaptiveUi, /\{item\.ctaLabel\}/);
});
