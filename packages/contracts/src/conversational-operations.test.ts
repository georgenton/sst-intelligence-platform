import { describe, expect, it } from 'vitest';
import {
  conversationActionRequestSchema,
  conversationFeedbackInputSchema,
  conversationMessageInputSchema,
  conversationThreadInputSchema,
  isConversationalWriteAction,
} from './conversational-operations';

describe('conversational operations contracts', () => {
  it('keeps the action registry allowlisted and classifies material writes', () => {
    expect(
      conversationActionRequestSchema.parse({
        actionKey: 'get_my_work_queue',
        idempotencyKey: 'queue-request-001',
        input: {},
      }),
    ).toMatchObject({ actionKey: 'get_my_work_queue' });
    expect(isConversationalWriteAction('create_finding')).toBe(true);
    expect(isConversationalWriteAction('get_inspection_context')).toBe(false);
    expect(
      conversationActionRequestSchema.safeParse({
        actionKey: 'delete_organization',
        idempotencyKey: 'not-allowed-001',
        input: {},
      }).success,
    ).toBe(false);
  });

  it('requires explicit bounded staging action context and categorical feedback', () => {
    expect(
      conversationMessageInputSchema.safeParse({
        content: 'Preparar propuesta',
        providerUseCase: 'ACTION_PROPOSAL',
      }).success,
    ).toBe(false);
    expect(
      conversationMessageInputSchema.safeParse({
        content: 'Preparar propuesta',
        providerUseCase: 'ACTION_PROPOSAL',
        providerActionContext: {
          actionKey: 'create_action',
          inspectionId: '10000000-0000-4000-8000-000000000001',
          findingId: '10000000-0000-4000-8000-000000000002',
        },
      }).success,
    ).toBe(true);
    expect(
      conversationFeedbackInputSchema.parse({ useful: false, reason: 'CITATION_ISSUE' }),
    ).toEqual({ useful: false, reason: 'CITATION_ISSUE' });
    expect(
      conversationFeedbackInputSchema.safeParse({ useful: false, reason: 'free text' }).success,
    ).toBe(false);
    expect(
      conversationFeedbackInputSchema.safeParse({ useful: true, reason: 'TOO_VERBOSE' }).success,
    ).toBe(false);
  });

  it('accepts bounded context and rejects incomplete context identity', () => {
    expect(
      conversationThreadInputSchema.parse({
        title: 'Inspección eléctrica',
        contextType: 'INSPECTION',
        contextId: 'inspection-id',
      }),
    ).toMatchObject({ contextType: 'INSPECTION' });
    expect(conversationThreadInputSchema.safeParse({ title: 'x' }).success).toBe(false);
  });
});
