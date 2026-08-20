import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export const ADAPTIVE_SESSION_MUTATION_SYNC = Symbol('ADAPTIVE_SESSION_MUTATION_SYNC');

export type AdaptiveSessionMutationOperation = 'SUBMIT_ANSWERS' | 'EVALUATE';
export type AdaptiveSessionMutationPhase = 'BEFORE_CLAIM' | 'AFTER_SUCCESSFUL_CLAIM';

export interface AdaptiveSessionMutationSync {
  point(context: {
    sessionId: string;
    operation: AdaptiveSessionMutationOperation;
    phase: AdaptiveSessionMutationPhase;
    tx: Prisma.TransactionClient;
  }): Promise<void>;
}

@Injectable()
export class NoopAdaptiveSessionMutationSync implements AdaptiveSessionMutationSync {
  point() {
    return Promise.resolve();
  }
}
