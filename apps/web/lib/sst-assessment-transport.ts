import { apiRequest } from '@sst/api-client';
import type { AssessmentSession, AssessmentTransport } from './sst-assessment-types';

type AuthenticatedRequest = <T>(
  path: string,
  init?: RequestInit,
  organizationId?: string,
) => Promise<T>;

function publicHeaders(token: string) {
  return { 'x-assessment-token': token };
}

export function createPublicAssessmentTransport(
  sessionId: string,
  publicToken: string,
): AssessmentTransport {
  const path = `/sst-assessment/public/sessions/${sessionId}`;
  return {
    channel: 'PUBLIC',
    get: () => apiRequest<AssessmentSession>(path, { headers: publicHeaders(publicToken) }),
    submitAnswers: (expectedSessionRevision, answers) =>
      apiRequest<AssessmentSession>(`${path}/answers`, {
        method: 'POST',
        headers: publicHeaders(publicToken),
        body: JSON.stringify({ expectedSessionRevision, answers }),
      }),
    evaluate: (expectedSessionRevision) =>
      apiRequest<AssessmentSession>(`${path}/evaluate`, {
        method: 'POST',
        headers: publicHeaders(publicToken),
        body: JSON.stringify({ expectedSessionRevision }),
      }),
    finalize: (expectedSessionRevision) =>
      apiRequest<AssessmentSession>(`${path}/complete`, {
        method: 'POST',
        headers: publicHeaders(publicToken),
        body: JSON.stringify({ expectedSessionRevision }),
      }),
  };
}

export function createAuthenticatedAssessmentTransport(
  request: AuthenticatedRequest,
  organizationId: string,
  sessionId: string,
): AssessmentTransport {
  const path = `/sst-assessment/sessions/${sessionId}`;
  return {
    channel: 'AUTHENTICATED',
    get: () => request<AssessmentSession>(path, undefined, organizationId),
    submitAnswers: (expectedSessionRevision, answers) =>
      request<AssessmentSession>(
        `${path}/answers`,
        { method: 'POST', body: JSON.stringify({ expectedSessionRevision, answers }) },
        organizationId,
      ),
    evaluate: (expectedSessionRevision) =>
      request<AssessmentSession>(
        `${path}/evaluate`,
        { method: 'POST', body: JSON.stringify({ expectedSessionRevision }) },
        organizationId,
      ),
    finalize: (expectedSessionRevision) =>
      request<AssessmentSession>(
        `${path}/finalize`,
        { method: 'POST', body: JSON.stringify({ expectedSessionRevision }) },
        organizationId,
      ),
  };
}
