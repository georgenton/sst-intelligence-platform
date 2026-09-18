import assert from 'node:assert/strict';
import test from 'node:test';
import { humanOperationalPriorityLabel } from '../lib/human-lexicon.ts';
import {
  isInheritedPlanItem,
  planDate,
  planExecutionCounts,
  planMissingFields,
  planStateLabel,
  planVersionSource,
} from '../lib/operational-plan-presentation.ts';
const item = (status, extra = {}) => ({
  id: status,
  title: 'Actividad',
  priority: 'MEDIUM',
  evidenceReferences: [],
  provenanceType: 'MANUAL',
  provenanceSnapshot: {},
  execution: { status, version: 1 },
  ...extra,
});
test('all four operational priorities are represented truthfully, including Urgente', () => {
  assert.deepEqual(['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(humanOperationalPriorityLabel), [
    'Baja',
    'Media',
    'Alta',
    'Urgente',
  ]);
});
test('counts all actual operational states without a invented progress percentage', () => {
  assert.deepEqual(
    planExecutionCounts(
      ['COMPLETED', 'IN_PROGRESS', 'PLANNED', 'CANCELED'].map((status) => item(status)),
    ),
    { completed: 1, inProgress: 1, planned: 1, canceled: 1 },
  );
  assert.deepEqual(planExecutionCounts([]), {
    completed: 0,
    inProgress: 0,
    planned: 0,
    canceled: 0,
  });
});
test('missing optional fields remain neutral and are counted per activity', () => {
  assert.deepEqual(
    planMissingFields([
      item('PLANNED'),
      item('COMPLETED', {
        responsible: { id: 'owner', displayName: 'Responsable' },
        dueAt: '2026-10-01',
        frequency: 'Mensual',
      }),
    ]),
    { responsible: 1, dueAt: 1, frequency: 1 },
  );
});
test('inheritance is established by persisted lineage, rather than matching names or provenance type', () => {
  assert.equal(isInheritedPlanItem(item('PLANNED')), false);
  assert.equal(
    isInheritedPlanItem(
      item('PLANNED', {
        provenanceType: 'UNIFIED_SST_EVALUATION',
        provenanceSnapshot: { inheritedFromItemId: 'original' },
      }),
    ),
    true,
  );
  assert.equal(
    isInheritedPlanItem(item('PLANNED', { provenanceSnapshot: { inheritedFromItemId: null } })),
    false,
  );
});
test('version source shows mixed existing plan and diagnosis without exposing technical identifiers', () => {
  assert.equal(
    planVersionSource({
      origin: 'DETERMINISTIC_DRAFT',
      provenance: { createdFrom: 'EXISTING_PLAN_AND_SST_ASSESSMENT' },
    }),
    'Plan vigente + diagnóstico',
  );
  assert.equal(
    planVersionSource({ origin: 'MANUAL', provenance: { createdFrom: 'SST_ASSESSMENT' } }),
    'Diagnóstico SST',
  );
  assert.equal(planVersionSource({ origin: 'MANUAL', provenance: {} }), 'Plan manual');
});
test('calendar dates retain their UTC business day and missing dates stay Por definir', () => {
  assert.equal(planDate('2026-09-01T00:00:00.000Z'), '1/9/2026');
  assert.equal(planDate(null), 'Por definir');
});
test('plan and execution labels remain distinct and show all source states', () => {
  assert.deepEqual(
    ['DRAFT', 'ACTIVE', 'RETIRED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'].map(
      planStateLabel,
    ),
    ['Borrador', 'Activo', 'Histórico', 'Planificado', 'En curso', 'Completado', 'Cancelado'],
  );
});
