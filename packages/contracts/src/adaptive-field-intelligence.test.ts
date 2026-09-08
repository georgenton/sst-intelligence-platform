import { describe, expect, it } from 'vitest';
import {
  assertMethodologyComparable,
  deriveGapAnalysisItems,
  inspectionDepthSnapshot,
  organizationSstProfileSchema,
  DEMO_APPLICABILITY_RULE_PACK,
  evaluateApplicability,
  calculateDemoRisk,
} from './index.js';

const source = {
  type: 'ADAPTIVE_CONFIGURATION' as const,
  id: '10000000-0000-4000-8000-000000000001',
};

describe('adaptive field intelligence boundaries', () => {
  it('preserves unknown profile facts with explicit provenance', () => {
    const profile = organizationSstProfileSchema.parse({
      schemaVersion: '2.0.0',
      organization: { country: 'EC', workCenterCount: 1, managementPriority: 'FOCUSED' },
      operations: {},
      contextFacts: [
        {
          key: 'CONTRACTOR_OR_EXTERNAL_PERSONNEL_PRESENT',
          value: 'UNKNOWN',
          scope: 'ORGANIZATION',
          provenance: { source: 'DECLARED_BY_ORGANIZATION', note: 'Pendiente de confirmar.' },
        },
      ],
    });
    expect(profile.contextFacts[0]?.value).toBe('UNKNOWN');
  });

  it('derives descriptive gaps without compliance claims and deterministically orders them', () => {
    const items = deriveGapAnalysisItems(source, [
      {
        itemId: '20000000-0000-4000-8000-000000000002',
        targetKey: 'CONTROL_B',
        title: 'Control B',
        expectedState: 'MANDATORY',
        currentState: 'IMPLEMENTED',
        evidenceReferences: [],
      },
      {
        itemId: '20000000-0000-4000-8000-000000000001',
        targetKey: 'CONTROL_A',
        title: 'Control A',
        expectedState: 'RECOMMENDED',
        missingFacts: ['turnos'],
      },
    ]);
    expect(items.map(({ targetKey, type }) => [targetKey, type])).toEqual([
      ['CONTROL_A', 'INFORMATION_REQUIRED'],
      ['CONTROL_B', 'EVIDENCE_REQUIRED'],
    ]);
    expect(JSON.stringify(items)).not.toMatch(/NON_COMPLIANT|COMPLIANT/);
  });

  it('keeps depth finite and versioned', () => {
    expect(inspectionDepthSnapshot('SYSTEMIC')).toEqual({
      depth: 'SYSTEMIC',
      version: '1.0.0',
      guidance: expect.stringContaining('transversal'),
    });
  });

  it('rejects raw comparison across risk method versions', () => {
    expect(assertMethodologyComparable(['method-a', 'method-a', null]).comparable).toBe(true);
    expect(assertMethodologyComparable(['method-a', 'method-b']).comparable).toBe(false);
  });

  it('keeps management priority outside legal applicability and deterministic risk inputs', () => {
    const base = {
      schemaVersion: '2.0.0' as const,
      operations: {},
      contextFacts: [],
      organization: { country: 'EC', workCenterCount: 1 },
    };
    const routine = {
      ...base,
      organization: { ...base.organization, managementPriority: 'ROUTINE' as const },
    };
    const urgent = {
      ...base,
      organization: { ...base.organization, managementPriority: 'URGENT' as const },
    };
    expect(evaluateApplicability(routine, DEMO_APPLICABILITY_RULE_PACK)).toEqual(
      evaluateApplicability(urgent, DEMO_APPLICABILITY_RULE_PACK),
    );
    expect(calculateDemoRisk(4, 5)).toEqual(calculateDemoRisk(4, 5));
  });
});
