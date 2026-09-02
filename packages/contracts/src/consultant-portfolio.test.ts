import { describe, expect, it } from 'vitest';
import {
  COPILOT_PROHIBITED_AUTHORITIES,
  PORTFOLIO_CONTEXT_TYPE,
  futureProviderConfigurationSchema,
  portfolioCitationsAreAuthorized,
  portfolioCitationSchema,
  portfolioDraftResultSchema,
  portfolioDueState,
  portfolioQuerySchema,
} from './consultant-portfolio';

describe('consultant portfolio contracts', () => {
  it('keeps filters bounded and organization selection explicit', () => {
    expect(
      portfolioQuerySchema.parse({
        organizationId: '00000000-0000-4000-8000-000000000001',
        pageSize: '50',
      }),
    ).toMatchObject({ page: 1, pageSize: 50, attention: 'ALL', dueState: 'ALL' });
    expect(() => portfolioQuerySchema.parse({ pageSize: 51 })).toThrow();
    expect(PORTFOLIO_CONTEXT_TYPE).toBe('PORTFOLIO_READ_ONLY');
  });

  it('rejects citations outside the current authorized organization set', () => {
    const citation = {
      id: 'work:org-a:action-a',
      organizationId: '00000000-0000-4000-8000-000000000001',
      organizationName: 'Empresa sintética A',
      sourceType: 'CORRECTIVE_ACTION',
      sourceId: 'action-a',
      label: 'Acción sintética',
      deepLink: '/app/work',
    };
    expect(portfolioCitationsAreAuthorized([citation], [citation.organizationId])).toBe(true);
    expect(portfolioCitationSchema.parse({ ...citation, deepLink: '/app' })).toMatchObject({
      deepLink: '/app',
    });
    expect(
      portfolioCitationsAreAuthorized([citation], ['00000000-0000-4000-8000-000000000002']),
    ).toBe(false);
  });

  it('keeps drafts non-canonical and future provider configuration secret-free', () => {
    expect(
      portfolioDraftResultSchema.parse({
        kind: 'DRAFT_RESULT',
        content: 'Borrador sintético',
        citationIds: [],
        canonical: false,
        persisted: false,
        reviewRequired: true,
      }),
    ).toMatchObject({ canonical: false, persisted: false, reviewRequired: true });
    expect(
      futureProviderConfigurationSchema.parse({
        providerKey: 'FUTURE_PROVIDER',
        configIdentifier: 'provider-neutral-evaluation-v1',
        mode: 'GENERATIVE',
        externalProcessing: true,
        secretReferenceNames: ['FUTURE_PROVIDER_API_KEY'],
      }),
    ).not.toHaveProperty('secret');
    expect(COPILOT_PROHIBITED_AUTHORITIES).toContain('AUTONOMOUS_MATERIAL_MUTATION');
  });

  it('classifies due windows deterministically', () => {
    const now = new Date('2026-09-02T12:00:00.000Z');
    expect(portfolioDueState({ dueAt: null, now })).toBe('NO_DUE');
    expect(portfolioDueState({ dueAt: '2026-09-01T12:00:00.000Z', now })).toBe('OVERDUE');
    expect(portfolioDueState({ dueAt: '2026-09-05T12:00:00.000Z', now })).toBe('DUE_SOON');
    expect(portfolioDueState({ dueAt: '2026-10-01T12:00:00.000Z', now })).toBe('FUTURE');
  });
});
