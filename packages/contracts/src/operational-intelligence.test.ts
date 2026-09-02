import { describe, expect, it } from 'vitest';
import {
  deriveOverdueActionClusterSignals,
  deriveRepeatedFindingSignals,
  normalizeSignalCategory,
  OPERATIONAL_SIGNAL_MINIMUM_COUNT,
  OPERATIONAL_SIGNAL_WINDOW_DAYS,
} from './operational-intelligence';

const now = new Date('2026-09-01T12:00:00.000Z');

describe('operational intelligence contracts', () => {
  it('documents non-legal operational defaults', () => {
    expect(OPERATIONAL_SIGNAL_MINIMUM_COUNT).toBe(3);
    expect(OPERATIONAL_SIGNAL_WINDOW_DAYS).toBe(90);
    expect(normalizeSignalCategory('  Caída   al MISMO nivel ')).toBe('caida al mismo nivel');
  });

  it('derives repeated findings deterministically regardless of input order', () => {
    const findings = ['c', 'a', 'b'].map((id, index) => ({
      id,
      organizationId: 'org-a',
      workCenterId: 'center-a',
      category: index === 0 ? 'Orden y limpieza' : 'orden  y limpieza',
      status: 'OPEN',
      createdAt: new Date(`2026-08-${20 + index}T12:00:00.000Z`),
    }));
    const forward = deriveRepeatedFindingSignals(findings, now);
    const reversed = deriveRepeatedFindingSignals([...findings].reverse(), now);
    expect(forward).toEqual(reversed);
    expect(forward[0]).toMatchObject({
      type: 'REPEATED_FINDING',
      observedCount: 3,
      threshold: 3,
      attention: 'REVIEW',
    });
    expect(forward[0]!.explanation).toContain('no identifica causa raíz');
  });

  it('derives only bounded overdue action clusters with stable provenance', () => {
    const actions = ['3', '1', '2'].map((id) => ({
      id,
      organizationId: 'org-a',
      workCenterId: 'center-a',
      sourceType: 'CORRECTIVE_ACTION',
      title: `Acción ${id}`,
      status: 'OPEN',
      dueAt: new Date('2026-08-20T12:00:00.000Z'),
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
    }));
    const result = deriveOverdueActionClusterSignals(actions, now);
    expect(result).toHaveLength(1);
    expect(result[0]!.sourceRecords.map(({ id }) => id)).toEqual(['1', '2', '3']);
    expect(result[0]!.explanation).toContain('señal operativa');
  });
});
