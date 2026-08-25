import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectionRiskMethodRenderer,
  presentInspectionRiskMethod,
} from '../lib/risk-method-presentation.ts';

test('adapts the historical inspection method without changing its calculation', () => {
  assert.deepEqual(presentInspectionRiskMethod('DEMO_5X5', '1.0.0'), {
    displayName: 'Matriz demostrativa 5×5',
    version: '1.0.0',
    isDemo: true,
    statusLabel: 'Demostración',
    technicalKey: 'DEMO_5X5',
    contextSummary: 'Valoración histórica utilizada para este hallazgo.',
  });
  assert.equal(inspectionRiskMethodRenderer('DEMO_5X5'), 'demo-five-by-five');
  assert.equal(inspectionRiskMethodRenderer('FUTURE_METHOD'), undefined);
});

test('systemic presentation keeps method identities separate without cross-method arithmetic', () => {
  const presentations = [
    presentInspectionRiskMethod('DEMO_5X5', '1.0.0'),
    presentInspectionRiskMethod('FUTURE_FIXTURE', '2.0.0'),
  ];
  assert.deepEqual(
    presentations.map(({ displayName, version }) => ({ displayName, version })),
    [
      { displayName: 'Matriz demostrativa 5×5', version: '1.0.0' },
      { displayName: 'Metodología registrada', version: '2.0.0' },
    ],
  );
  assert.equal(
    presentations.some((item) => 'score' in item),
    false,
  );
});
