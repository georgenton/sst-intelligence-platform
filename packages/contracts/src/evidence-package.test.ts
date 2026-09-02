import { describe, expect, it } from 'vitest';
import { assertEvidencePackageTransition, orderEvidenceManifestItems } from './evidence-package';

describe('evidence package contracts', () => {
  it('enforces the bounded immutable lifecycle', () => {
    expect(() => assertEvidencePackageTransition('DRAFT', 'FINALIZED')).not.toThrow();
    expect(() => assertEvidencePackageTransition('FINALIZED', 'ARCHIVED')).not.toThrow();
    expect(() => assertEvidencePackageTransition('FINALIZED', 'DRAFT')).toThrow(
      'INVALID_EVIDENCE_PACKAGE_TRANSITION:FINALIZED:DRAFT',
    );
    expect(() => assertEvidencePackageTransition('ARCHIVED', 'FINALIZED')).toThrow();
  });

  it('orders canonical source references deterministically', () => {
    const items = orderEvidenceManifestItems([
      { type: 'INSPECTION' as const, sourceId: 'b' },
      { type: 'FINDING' as const, sourceId: 'c' },
      { type: 'INSPECTION' as const, sourceId: 'a' },
    ]);
    expect(items.map(({ type, sourceId }) => `${type}:${sourceId}`)).toEqual([
      'FINDING:c',
      'INSPECTION:a',
      'INSPECTION:b',
    ]);
  });
});
