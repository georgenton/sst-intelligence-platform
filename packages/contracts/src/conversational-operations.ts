import { z } from 'zod';

export const CONVERSATION_CONTEXT_TYPES = [
  'GLOBAL',
  'WORK_ITEM',
  'INSPECTION',
  'FINDING',
  'WORKER',
  'INCIDENT',
  'PPE',
  'TRAINING',
  'WORK_PERMIT',
  'OBLIGATION',
] as const;

export const CONVERSATIONAL_READ_ACTIONS = [
  'get_my_work_queue',
  'get_work_item_context',
  'get_inspection_context',
  'get_inspection_basis',
  'get_criterion_context',
  'get_criterion_provenance',
  'get_regulatory_unit',
  'get_evidence_context',
  'get_worker_context',
  'get_incident_context',
  'get_ppe_context',
  'get_training_context',
  'get_work_permit_context',
  'get_obligation_context',
  'explain_work_item',
] as const;

export const CONVERSATIONAL_WRITE_ACTIONS = [
  'create_inspection',
  'start_inspection',
  'record_criterion_result',
  'attach_evidence',
  'create_finding',
  'create_action',
  'assign_action',
] as const;

export const CONVERSATIONAL_ACTION_KEYS = [
  ...CONVERSATIONAL_READ_ACTIONS,
  ...CONVERSATIONAL_WRITE_ACTIONS,
] as const;

export const CONVERSATION_CITATION_TYPES = [
  'INSPECTION_BASIS_VERSION',
  'INSPECTION_STANDARD_VERSION',
  'INSPECTION_STANDARD_CRITERION',
  'REGULATORY_UNIT',
  'ORGANIZATION_POLICY',
  'FINDING',
  'ACTION',
  'WORK_ITEM',
] as const;

export const CONVERSATIONAL_PROVIDER_USE_CASES = [
  'WORK_QUEUE_EXPLANATION',
  'CURRENT_CONTEXT_EXPLANATION',
  'CITATION_SUMMARY',
  'OPERATIONAL_DRAFT',
  'ACTION_PROPOSAL',
] as const;

export const CONVERSATIONAL_FEEDBACK_REASONS = [
  'INCORRECT',
  'UNCLEAR',
  'MISSING_CONTEXT',
  'CITATION_ISSUE',
  'TOO_VERBOSE',
  'ACTION_SUGGESTION_ISSUE',
] as const;

export const conversationProviderActionContextSchema = z.object({
  actionKey: z.literal('create_action'),
  inspectionId: z.string().uuid(),
  findingId: z.string().uuid(),
});

export const conversationThreadInputSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  contextType: z.enum(CONVERSATION_CONTEXT_TYPES).optional(),
  contextId: z.string().trim().min(1).max(160).optional(),
});

export const conversationMessageInputSchema = z
  .object({
    content: z.string().trim().min(1).max(4_000),
    providerUseCase: z.enum(CONVERSATIONAL_PROVIDER_USE_CASES).optional(),
    providerActionContext: conversationProviderActionContextSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.providerUseCase === 'ACTION_PROPOSAL' && !input.providerActionContext) {
      context.addIssue({
        code: 'custom',
        path: ['providerActionContext'],
        message: 'La propuesta requiere un contexto de acción explícito.',
      });
    }
    if (input.providerUseCase !== 'ACTION_PROPOSAL' && input.providerActionContext) {
      context.addIssue({
        code: 'custom',
        path: ['providerActionContext'],
        message: 'El contexto de acción solo está permitido para una propuesta explícita.',
      });
    }
  });

export const conversationFeedbackInputSchema = z
  .object({
    useful: z.boolean(),
    reason: z.enum(CONVERSATIONAL_FEEDBACK_REASONS).optional(),
  })
  .superRefine((input, context) => {
    if (input.useful && input.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Una respuesta útil no requiere una categoría de problema.',
      });
    }
  });

export const conversationProviderControlInputSchema = z.object({
  externalEnabled: z.boolean(),
});

export const conversationActionRequestSchema = z.object({
  actionKey: z.enum(CONVERSATIONAL_ACTION_KEYS),
  idempotencyKey: z.string().trim().min(8).max(160),
  input: z.record(z.string(), z.unknown()),
});

export function isConversationalWriteAction(
  actionKey: (typeof CONVERSATIONAL_ACTION_KEYS)[number],
): actionKey is (typeof CONVERSATIONAL_WRITE_ACTIONS)[number] {
  return (CONVERSATIONAL_WRITE_ACTIONS as readonly string[]).includes(actionKey);
}

export type ConversationActionKey = (typeof CONVERSATIONAL_ACTION_KEYS)[number];
export type ConversationCitationType = (typeof CONVERSATION_CITATION_TYPES)[number];
export type ConversationContextType = (typeof CONVERSATION_CONTEXT_TYPES)[number];
export type ConversationProviderUseCase = (typeof CONVERSATIONAL_PROVIDER_USE_CASES)[number];
export type ConversationFeedbackReason = (typeof CONVERSATIONAL_FEEDBACK_REASONS)[number];
