import type {
  SstAssessmentFact,
  SstAssessmentProgress,
  SstAssessmentQuestion,
  SstAssessmentResult,
  SstAssessmentSnapshot,
} from '@sst/contracts';

export type AssessmentChannel = 'PUBLIC' | 'AUTHENTICATED';
export type AssessmentStatus =
  'COLLECTING_INFORMATION' | 'DIAGNOSIS_READY' | 'FINALIZED' | 'EXPIRED';

export type AssessmentSession = {
  id: string;
  channel: AssessmentChannel;
  kind: 'INITIAL_ASSESSMENT' | 'REASSESSMENT';
  status: AssessmentStatus;
  sessionRevision: number;
  snapshot: SstAssessmentSnapshot;
  questions: SstAssessmentQuestion[];
  progress: SstAssessmentProgress;
  requiredActions: Array<{ code: string; message: string }>;
  result: SstAssessmentResult | null;
  finalSnapshot: SstAssessmentSnapshot | null;
  parentAssessmentId: string | null;
  expiresAt: string | null;
  finalizedAt: string | null;
};

export type AssessmentAnswer = Pick<SstAssessmentFact, 'scopeKey' | 'factKey' | 'answerState'> & {
  value?: boolean | number | string | string[];
};

export type AssessmentHistoryItem = Pick<
  AssessmentSession,
  'id' | 'channel' | 'kind' | 'status' | 'sessionRevision' | 'parentAssessmentId' | 'finalizedAt'
> & { createdAt: string; updatedAt: string };

export type AssessmentSetupState = {
  state: 'NEEDS_ASSESSMENT' | 'ASSESSMENT_IN_PROGRESS' | 'DIAGNOSIS_READY' | 'LEGACY_CONFIGURED';
  hardGate: boolean;
  assessmentId: string | null;
  status?: AssessmentStatus;
  finalizedAt?: string;
};

export type AssessmentTransport = {
  channel: AssessmentChannel;
  get(): Promise<AssessmentSession>;
  submitAnswers(revision: number, answers: AssessmentAnswer[]): Promise<AssessmentSession>;
  evaluate(revision: number): Promise<AssessmentSession>;
  finalize(revision: number): Promise<AssessmentSession>;
};
