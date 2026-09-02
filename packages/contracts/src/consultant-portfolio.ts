import { z } from 'zod';

export const PORTFOLIO_CONTEXT_TYPE = 'PORTFOLIO_READ_ONLY' as const;

export const PORTFOLIO_READ_ACTIONS = [
  'get_portfolio_summary',
  'get_portfolio_attention',
  'get_portfolio_overdue_work',
  'get_portfolio_signals',
  'get_portfolio_evidence_state',
  'get_organization_summary',
  'search_portfolio',
] as const;

export const COPILOT_PRODUCT_CAPABILITIES = [
  'SEARCH',
  'EXPLAIN',
  'SUMMARIZE',
  'COMPARE_FACTUAL_STATE',
  'DRAFT',
  'SUGGEST_NEXT_QUESTION',
] as const;

export const COPILOT_PROHIBITED_AUTHORITIES = [
  'FINAL_RISK_DECISION',
  'LEGAL_COMPLIANCE_DECISION',
  'AUTOMATIC_ROOT_CAUSE',
  'WORKER_SAFETY_SCORE',
  'AUTONOMOUS_MATERIAL_MUTATION',
] as const;

export const PORTFOLIO_WORK_TYPES = [
  'CORRECTIVE_ACTION',
  'INCIDENT_ACTION',
  'OBLIGATION_EXECUTION',
  'GOVERNANCE_ACTION',
  'WORK_PERMIT_APPROVAL',
  'WORK_PERMIT_SUSPENDED',
  'WORK_PERMIT_DUE',
  'OPERATIONAL_SIGNAL',
] as const;

export const PORTFOLIO_DUE_STATES = ['ALL', 'OVERDUE', 'DUE_SOON', 'FUTURE', 'NO_DUE'] as const;
export const PORTFOLIO_ATTENTION_STATES = [
  'ALL',
  'NEEDS_ATTENTION',
  'NO_CRITICAL_PENDING',
] as const;
export const PORTFOLIO_SIGNAL_TYPES = ['REPEATED_FINDING', 'OVERDUE_ACTION_CLUSTER'] as const;

export const portfolioQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  attention: z.enum(PORTFOLIO_ATTENTION_STATES).default('ALL'),
  workType: z.enum(PORTFOLIO_WORK_TYPES).optional(),
  dueState: z.enum(PORTFOLIO_DUE_STATES).default('ALL'),
  signalType: z.enum(PORTFOLIO_SIGNAL_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const portfolioCopilotRequestSchema = z.object({
  content: z.string().trim().min(1).max(4_000),
  organizationId: z.string().uuid().optional(),
});

export const portfolioCitationSchema = z.object({
  id: z.string().min(1).max(500),
  organizationId: z.string().uuid(),
  organizationName: z.string().min(1).max(240),
  sourceType: z.string().min(1).max(80),
  sourceId: z.string().min(1).max(160),
  label: z.string().min(1).max(500),
  deepLink: z.string().regex(/^\/app(?:\/|$)/),
});

export const COPILOT_CONTEXT_RESULTS = [
  'ANSWERED',
  'INSUFFICIENT_CONTEXT',
  'SOURCE_NOT_AVAILABLE',
  'NOT_AUTHORIZED',
  'PROFESSIONAL_REVIEW_REQUIRED',
] as const;

export const portfolioDraftResultSchema = z.object({
  kind: z.literal('DRAFT_RESULT'),
  content: z.string().min(1),
  citationIds: z.array(z.string()),
  canonical: z.literal(false),
  persisted: z.literal(false),
  reviewRequired: z.literal(true),
});

export const portfolioSummarizationInputSchema = z.object({
  context: z.literal(PORTFOLIO_CONTEXT_TYPE),
  facts: z.array(
    z.object({
      organizationId: z.string().uuid(),
      fact: z.string().min(1),
      citationId: z.string().min(1),
    }),
  ),
});

export const portfolioSummarizationResultSchema = z.object({
  summary: z.string().min(1),
  supportingCitationIds: z.array(z.string()),
  coverage: z.object({
    supportedFactCount: z.number().int().min(0),
    totalFactCount: z.number().int().min(0),
  }),
  uncertainty: z.array(z.string()),
});

export const portfolioSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(160),
  organizationIds: z.array(z.string().uuid()).max(50),
  limit: z.number().int().min(1).max(50).default(20),
});

export const portfolioSearchResultSchema = z.object({
  items: z.array(
    z.object({
      organizationId: z.string().uuid(),
      sourceType: z.string().min(1),
      sourceId: z.string().min(1),
      label: z.string().min(1),
      citationId: z.string().min(1),
    }),
  ),
  deterministic: z.literal(true),
});

export const futureProviderConfigurationSchema = z.object({
  providerKey: z.string().trim().min(1).max(100),
  configIdentifier: z.string().trim().min(1).max(160),
  mode: z.enum(['DETERMINISTIC_LOCAL', 'GENERATIVE']),
  externalProcessing: z.boolean(),
  secretReferenceNames: z.array(z.string().trim().min(1).max(120)).max(10),
});

export type PortfolioQuery = z.infer<typeof portfolioQuerySchema>;
export type PortfolioReadAction = (typeof PORTFOLIO_READ_ACTIONS)[number];
export type PortfolioWorkType = (typeof PORTFOLIO_WORK_TYPES)[number];
export type PortfolioDueState = (typeof PORTFOLIO_DUE_STATES)[number];
export type PortfolioContextResult = (typeof COPILOT_CONTEXT_RESULTS)[number];
export type PortfolioCitation = z.infer<typeof portfolioCitationSchema>;
export type PortfolioCopilotRequest = z.infer<typeof portfolioCopilotRequestSchema>;

export function portfolioCitationsAreAuthorized(
  citations: readonly PortfolioCitation[],
  authorizedOrganizationIds: readonly string[],
) {
  const authorized = new Set(authorizedOrganizationIds);
  return citations.every(({ organizationId }) => authorized.has(organizationId));
}

export function portfolioDueState(input: { dueAt: Date | string | null; now: Date }) {
  if (!input.dueAt) return 'NO_DUE' as const;
  const dueAt = new Date(input.dueAt);
  if (dueAt < input.now) return 'OVERDUE' as const;
  const dueSoonBoundary = new Date(input.now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  return dueAt <= dueSoonBoundary ? ('DUE_SOON' as const) : ('FUTURE' as const);
}
