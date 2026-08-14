import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export const TECHNICAL_ASSESSMENT_MUTATION_SYNC = Symbol('TECHNICAL_ASSESSMENT_MUTATION_SYNC');

export type TechnicalAssessmentMutationOperation =
  'COMPLETE' | 'UPDATE_ASSESSMENT' | 'UPSERT_RESPONSE' | 'ADD_EVIDENCE';

export type TechnicalAssessmentMutationPhase = 'BEFORE_CLAIM' | 'AFTER_SUCCESSFUL_CLAIM';

export type TechnicalAssessmentMutationSyncContext = {
  assessmentId: string;
  operation: TechnicalAssessmentMutationOperation;
  phase: TechnicalAssessmentMutationPhase;
  tx: Prisma.TransactionClient;
};

export interface TechnicalAssessmentMutationSync {
  point(context: TechnicalAssessmentMutationSyncContext): Promise<void>;
}

@Injectable()
export class NoopTechnicalAssessmentMutationSync implements TechnicalAssessmentMutationSync {
  point() {
    return Promise.resolve();
  }
}
