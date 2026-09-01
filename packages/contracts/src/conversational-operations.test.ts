import { describe, expect, it } from 'vitest';
import {
  conversationActionRequestSchema,
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
