import type { SstAssessmentFact, SstAssessmentScope } from '@sst/contracts';
import type { AssessmentAnswer } from './sst-assessment-types';
import { assessmentChoiceLabel, visibleFactSummaries } from './sst-assessment-presentation';

export type AssessmentContextChange = {
  identity: string;
  scopeKey: string;
  kind: 'added' | 'updated';
  text: string;
};

// Presentation only: compare the two confirmed snapshots, never infer a fact.
export function assessmentContextChanges(
  before: readonly SstAssessmentFact[],
  after: readonly SstAssessmentFact[],
  scopes: readonly SstAssessmentScope[],
): AssessmentContextChange[] {
  const previous = new Map(before.map((fact) => [`${fact.scopeKey}:${fact.factKey}`, fact]));
  const summaries = new Map(
    visibleFactSummaries(after, scopes).map((item) => [item.identity, item]),
  );
  return after.flatMap((fact) => {
    const identity = `${fact.scopeKey}:${fact.factKey}`;
    const summary = summaries.get(identity);
    if (!summary) return [];
    const old = previous.get(identity);
    if (
      old &&
      old.answerState === fact.answerState &&
      JSON.stringify(old.answerState === 'KNOWN' ? old.value : null) ===
        JSON.stringify(fact.answerState === 'KNOWN' ? fact.value : null)
    )
      return [];
    // Additional free context and sensitive answers never enter transient feedback.
    const sensitive = [
      'organization.additionalContext',
      'organization.psychosocialReviewNeeded',
      'organization.stressExposedRolesPresent',
    ].includes(fact.factKey);
    return [
      {
        identity,
        scopeKey: fact.scopeKey,
        kind: old ? ('updated' as const) : ('added' as const),
        text: sensitive ? 'Contexto confirmado' : `${summary.label}: ${summary.value}`,
      },
    ];
  });
}

export function assessmentCenterRelay(
  outgoingScopeKey: string | undefined,
  incomingScopeKey: string | undefined,
  scopes: readonly SstAssessmentScope[],
) {
  if (!outgoingScopeKey || !incomingScopeKey || outgoingScopeKey === incomingScopeKey) return null;
  const centers = scopes.filter(({ kind }) => kind === 'WORK_CENTER');
  const from = centers.find(({ scopeKey }) => scopeKey === outgoingScopeKey);
  const to = centers.find(({ scopeKey }) => scopeKey === incomingScopeKey);
  if (!from || !to) return null;
  return {
    from,
    to,
    fromLabel: `Centro ${centers.indexOf(from) + 1}`,
    toLabel: `Centro ${centers.indexOf(to) + 1}`,
    total: centers.length,
  };
}

export function assessmentProcessingAnswer(answer: AssessmentAnswer) {
  if (answer.answerState === 'EXPLICIT_UNKNOWN') return 'No lo sé';
  if (answer.factKey === 'organization.additionalContext') return 'Contexto escrito';
  if (typeof answer.value === 'boolean') return answer.value ? 'Sí' : 'No';
  if (typeof answer.value === 'number') return new Intl.NumberFormat('es-EC').format(answer.value);
  if (Array.isArray(answer.value))
    return answer.value.map((value) => assessmentChoiceLabel(answer.factKey, value)).join(', ');
  if (typeof answer.value === 'string')
    return assessmentChoiceLabel(answer.factKey, answer.value).slice(0, 120);
  return undefined;
}
