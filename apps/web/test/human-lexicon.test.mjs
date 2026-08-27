import assert from 'node:assert/strict';
import test from 'node:test';
import {
  humanModuleAccessStatusLabel,
  humanOperationalPriorityLabel,
  humanOrganizationImplementationStatusLabel,
  humanRiskLevelLabel,
} from '../lib/human-lexicon.ts';

test('humanizes semantic risk levels without changing method-specific values', () => {
  assert.deepEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(humanRiskLevelLabel), [
    'Crítico',
    'Alto',
    'Medio',
    'Bajo',
  ]);
  assert.equal(humanRiskLevelLabel('IV'), 'IV');
});

test('keeps operational priorities distinct from semantic risk levels', () => {
  assert.deepEqual(['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(humanOperationalPriorityLabel), [
    'Urgente',
    'Alta',
    'Media',
    'Baja',
  ]);
});

test('humanizes module access statuses used in customer-facing catalog surfaces', () => {
  assert.equal(humanModuleAccessStatusLabel('ACTIVE'), 'Activo');
  assert.equal(humanModuleAccessStatusLabel('DEMO'), 'Demostración temporal');
});

test('humanizes organization implementation states used in regulatory context', () => {
  assert.equal(humanOrganizationImplementationStatusLabel('IN_PROGRESS'), 'En progreso');
  assert.equal(
    humanOrganizationImplementationStatusLabel('PARTIALLY_IMPLEMENTED'),
    'Parcialmente implementado',
  );
  assert.equal(humanOrganizationImplementationStatusLabel(null), 'No declarado todavía');
});
