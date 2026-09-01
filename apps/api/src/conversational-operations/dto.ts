import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';
import {
  CONVERSATIONAL_ACTION_KEYS,
  CONVERSATION_CONTEXT_TYPES,
  type ConversationActionKey,
  type ConversationContextType,
} from '@sst/contracts';

export class CreateConversationThreadDto {
  @IsOptional() @IsString() @Length(3, 160) title?: string;
  @IsOptional()
  @IsIn(CONVERSATION_CONTEXT_TYPES)
  contextType?: ConversationContextType;
  @IsOptional() @IsString() @Length(1, 160) contextId?: string;
}

export class SendConversationMessageDto {
  @IsString() @Length(1, 4_000) content!: string;
}

export class RunConversationActionDto {
  @IsIn(CONVERSATIONAL_ACTION_KEYS) actionKey!: ConversationActionKey;
  @IsString() @Length(8, 160) idempotencyKey!: string;
  @IsObject() input!: Record<string, unknown>;
}
