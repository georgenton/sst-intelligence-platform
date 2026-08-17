import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_APPLICABILITY_RULE_PACK } from '@sst/contracts';
import {
  applicabilityStateMeta,
  assessmentSnapshotPresentation,
  buildSstProfilePayload,
  canManageApplicability,
} from '../lib/applicability-experience.ts';

test('mirrors the backend create and evaluate role matrix', () => {
  for (const role of ['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']) {
    assert.equal(canManageApplicability(role), true, role);
  }
  for (const role of ['SST_TECHNICIAN', 'CONSULTANT', 'VIEWER']) {
    assert.equal(canManageApplicability(role), false, role);
  }
});

test('presents all six canonical states without expanding their legal meaning', () => {
  const states = [
    'MANDATORY',
    'RECOMMENDED',
    'OPTIONAL',
    'NOT_APPLICABLE',
    'NEEDS_INFORMATION',
    'NEEDS_EXPERT_REVIEW',
  ];
  const labels = states.map((state) => applicabilityStateMeta(state).label);

  assert.deepEqual(labels, [
    'Obligatorio en esta demostración',
    'Recomendado',
    'Opcional',
    'No aplica en esta demostración',
    'Falta información',
    'Requiere revisión profesional',
  ]);
  assert.match(applicabilityStateMeta('MANDATORY').label, /demostración/i);
  assert.doesNotMatch(
    `${applicabilityStateMeta('NOT_APPLICABLE').label} ${applicabilityStateMeta('NOT_APPLICABLE').description}`,
    /legalmente|obligación legal|cumplimiento legal/i,
  );
  assert.notEqual(applicabilityStateMeta('NEEDS_INFORMATION').label, 'No aplica');
});

test('omits unknown facts and never admits server-derived profile fields', () => {
  assert.deepEqual(
    buildSstProfilePayload({
      workerCount: '',
      hasChemicalProcesses: 'UNKNOWN',
      hasHighEnergyOperations: 'NO',
    }),
    { hasHighEnergyOperations: false },
  );
  const payload = buildSstProfilePayload({
    workerCount: '35',
    hasChemicalProcesses: 'YES',
    hasHighEnergyOperations: 'UNKNOWN',
  });
  assert.deepEqual(payload, { workerCount: 35, hasChemicalProcesses: true });
  assert.equal('country' in payload, false);
  assert.equal('sector' in payload, false);
  assert.equal('workCenterCount' in payload, false);
});

test('uses the persisted assessment snapshots for historical presentation', () => {
  const storedProfile = {
    schemaVersion: '1.0.0',
    organization: {
      country: 'Ecuador histórico',
      sector: 'Sector histórico',
      workCenterCount: 2,
      workerCount: 35,
    },
    operations: { hasChemicalProcesses: true },
  };
  const storedRulePack = {
    ...DEMO_APPLICABILITY_RULE_PACK,
    name: 'Motor persistido en el assessment',
    version: '1.0.0',
  };
  const presentation = assessmentSnapshotPresentation({
    profileSnapshot: storedProfile,
    rulePackSnapshot: storedRulePack,
  });

  assert.equal(presentation.profile.organization.country, 'Ecuador histórico');
  assert.equal(presentation.rulePack.name, 'Motor persistido en el assessment');
  assert.equal(presentation.rulePack.version, '1.0.0');
  assert.equal(presentation.rulePack.isDemo, true);
  assert.equal(presentation.rulePack.regulatory, false);
});
