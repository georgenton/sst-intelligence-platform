import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectionRiskMethodRenderer,
  presentGtc45Result,
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

test('presents GTC45 values and human labels without recalculating them', () => {
  const result = presentGtc45Result({
    methodKey: 'GTC45_2010',
    methodVersion: '1.0.0',
    deficiencyValue: 6,
    probabilityValue: 18,
    probabilityBand: 'HIGH',
    consequenceValue: 25,
    riskValue: 450,
    riskLevel: 'II',
    trace: {
      deficiency: { selection: 'HIGH', numericValue: 6 },
      probability: { exposureValue: 3, value: 18 },
      risk: { consequenceValue: 25, value: 450 },
    },
  });
  assert.deepEqual(result, {
    methodology: 'GTC45_2010 · v1.0.0',
    deficiency: 'Alto · ND 6',
    exposure: 'Frecuente · NE 3',
    probability: 'Alto · NP 18',
    consequence: 'Grave · NC 25',
    risk: 'NR 450',
    intervention: 'Nivel de intervención II',
    interpretation: 'Rango canónico registrado: NR entre 150 y 500.',
  });
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

test('finite renderer registry includes the three reviewed runtime methods', () => {
  assert.equal(inspectionRiskMethodRenderer('GUIDED_5X5'), 'guided-five-by-five');
  assert.equal(inspectionRiskMethodRenderer('GTC45_2010'), 'gtc45-2010');
  assert.deepEqual(presentInspectionRiskMethod('GUIDED_5X5', '1.0.0'), {
    displayName: 'Matriz 5×5 guiada',
    version: '1.0.0',
    isDemo: true,
    statusLabel: 'Candidata DEMO',
    technicalKey: 'GUIDED_5X5',
    contextSummary: 'Juicio profesional guiado con probabilidad y severidad humana.',
  });
  assert.match(
    presentInspectionRiskMethod('GTC45_2010', '1.0.0').contextSummary,
    /no implica adopción legal ecuatoriana/,
  );
});
