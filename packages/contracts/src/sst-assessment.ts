import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AdaptiveRuleTrace } from './adaptive-configuration.js';

export const SST_ASSESSMENT_SCHEMA_VERSION = '1.0.0' as const;
export const SST_ASSESSMENT_CATALOG_VERSION = '1.0.0' as const;
export const SST_ASSESSMENT_LIMITS = {
  workCenters: 100,
  answersPerRequest: 100,
  factsPerSnapshot: 2_000,
} as const;

export const SST_ASSESSMENT_AUTHORITIES = ['DEMO', 'CANDIDATE', 'PUBLISHED'] as const;
export const SST_ASSESSMENT_COLLECTION_POLICIES = [
  'FOUNDATION_REQUIRED',
  'CONDITIONAL',
  'SPECIALIST_REQUIRED',
  'CONTEXT_RECOMMENDED',
  'COMMERCIAL_OPTIONAL',
] as const;
export const SST_ASSESSMENT_RELEVANCE_POLICIES = [
  'ALWAYS',
  'AFTER_INSPECTION_PRACTICE',
  'PHYSICAL_OR_HYBRID_WORK_CENTER',
  'SPECIALIST_PROMOTED',
] as const;
export const SST_ASSESSMENT_ANSWER_STATES = ['KNOWN', 'EXPLICIT_UNKNOWN'] as const;
export const SST_ASSESSMENT_SCOPE_KINDS = ['ORGANIZATION', 'WORK_CENTER'] as const;
export const SST_ASSESSMENT_VALUE_TYPES = [
  'BOOLEAN',
  'INTEGER',
  'SHORT_TEXT',
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
] as const;

export type SstAssessmentAuthority = (typeof SST_ASSESSMENT_AUTHORITIES)[number];
export type SstAssessmentAnswerState = (typeof SST_ASSESSMENT_ANSWER_STATES)[number];
export type SstAssessmentScopeKind = (typeof SST_ASSESSMENT_SCOPE_KINDS)[number];
export type SstAssessmentValueType = (typeof SST_ASSESSMENT_VALUE_TYPES)[number];
export type SstAssessmentCollectionPolicy = (typeof SST_ASSESSMENT_COLLECTION_POLICIES)[number];
export type SstAssessmentRelevancePolicy = (typeof SST_ASSESSMENT_RELEVANCE_POLICIES)[number];
export type SstAssessmentFactValue = boolean | number | string | string[];

export const sstAssessmentProvenanceSchema = z
  .object({
    source: z.enum([
      'PUBLIC_DECLARATION',
      'ORGANIZATION_DECLARATION',
      'ORGANIZATION_RECORD',
      'PREVIOUS_ASSESSMENT',
    ]),
    sourceReference: z.string().trim().min(1).max(240).optional(),
  })
  .strict();
export type SstAssessmentProvenance = z.infer<typeof sstAssessmentProvenanceSchema>;

export const sstAssessmentScopeSchema = z
  .object({
    scopeKey: z.string().regex(/^(organization|center:[1-9][0-9]{0,2})$/),
    kind: z.enum(SST_ASSESSMENT_SCOPE_KINDS),
    order: z.number().int().min(0).max(SST_ASSESSMENT_LIMITS.workCenters),
    displayName: z.string().trim().min(1).max(160),
    workCenterId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((scope, context) => {
    if ((scope.scopeKey === 'organization') !== (scope.kind === 'ORGANIZATION')) {
      context.addIssue({ code: 'custom', path: ['kind'], message: 'Scope key and kind differ' });
    }
    if (scope.kind === 'ORGANIZATION' && scope.workCenterId) {
      context.addIssue({
        code: 'custom',
        path: ['workCenterId'],
        message: 'Organization scope cannot reference a work center',
      });
    }
  });
export type SstAssessmentScope = z.infer<typeof sstAssessmentScopeSchema>;

const knownAssessmentFactSchema = z
  .object({
    factKey: z.string().regex(/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/),
    scopeKey: z.string().regex(/^(organization|center:[1-9][0-9]{0,2})$/),
    answerState: z.literal('KNOWN'),
    value: z.union([z.boolean(), z.number().finite(), z.string(), z.array(z.string()).max(30)]),
    provenance: sstAssessmentProvenanceSchema,
  })
  .strict();

const explicitlyUnknownAssessmentFactSchema = z
  .object({
    factKey: z.string().regex(/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/),
    scopeKey: z.string().regex(/^(organization|center:[1-9][0-9]{0,2})$/),
    answerState: z.literal('EXPLICIT_UNKNOWN'),
    provenance: sstAssessmentProvenanceSchema,
  })
  .strict();

export const sstAssessmentFactSchema = z.discriminatedUnion('answerState', [
  knownAssessmentFactSchema,
  explicitlyUnknownAssessmentFactSchema,
]);
export type SstAssessmentFact = z.infer<typeof sstAssessmentFactSchema>;

export const sstAssessmentSnapshotSchema = z
  .object({
    schemaVersion: z.literal(SST_ASSESSMENT_SCHEMA_VERSION),
    catalogVersion: z.literal(SST_ASSESSMENT_CATALOG_VERSION),
    scopes: z
      .array(sstAssessmentScopeSchema)
      .min(1)
      .max(SST_ASSESSMENT_LIMITS.workCenters + 1),
    facts: z.array(sstAssessmentFactSchema).max(SST_ASSESSMENT_LIMITS.factsPerSnapshot),
  })
  .strict();
export type SstAssessmentSnapshot = z.infer<typeof sstAssessmentSnapshotSchema>;

export type SstAssessmentFactDefinition = {
  factKey: string;
  topic: string;
  scopeKind: SstAssessmentScopeKind;
  valueType: SstAssessmentValueType;
  unknownAllowed: boolean;
  questionText: string;
  helpText: string;
  choices: Array<{ value: string; label: string }>;
  purpose: string;
  order: number;
  sensitivity: 'LOW' | 'MEDIUM';
  authenticatedDerived: boolean;
  collectionPolicy: SstAssessmentCollectionPolicy;
  relevancePolicy: SstAssessmentRelevancePolicy;
  blocksReadiness: boolean;
  allowEmpty: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
};
export { SST_ASSESSMENT_FACT_CATALOG } from './sst-assessment-catalog.js';
import { SST_ASSESSMENT_FACT_CATALOG } from './sst-assessment-catalog.js';
export const sstAssessmentQuestionSchema = z
  .object({
    questionId: z.string().min(1),
    factKey: z.string().min(1),
    scopeKey: z.string().min(1),
    topic: z.string().min(1),
    valueType: z.enum(SST_ASSESSMENT_VALUE_TYPES),
    unknownAllowed: z.boolean(),
    questionText: z.string().min(1),
    helpText: z.string(),
    choices: z.array(z.object({ value: z.string(), label: z.string() }).strict()),
    purpose: z.string().min(1),
    order: z.number().int(),
    sensitivity: z.enum(['LOW', 'MEDIUM']),
    relatedRuleKeys: z.array(z.string()),
    relatedTargetKeys: z.array(z.string()),
    collectionPolicy: z.enum(SST_ASSESSMENT_COLLECTION_POLICIES),
    relevancePolicy: z.enum(SST_ASSESSMENT_RELEVANCE_POLICIES),
    blocking: z.boolean(),
  })
  .strict();
export type SstAssessmentQuestion = z.infer<typeof sstAssessmentQuestionSchema>;

export type SstAssessmentProgress = {
  answeredFacts: number;
  resolvedFactCount: number;
  explicitUnknownCount: number;
  pendingQuestionCount: number;
  totalFacts: number;
  completedTopics: number;
  totalTopics: number;
  topics: Array<{ topic: string; answered: number; total: number; complete: boolean }>;
};

export type SstAssessmentResult = {
  schemaVersion: typeof SST_ASSESSMENT_SCHEMA_VERSION;
  authoritiesPresent: SstAssessmentAuthority[];
  summary: { title: string; disclaimer: string };
  progress: SstAssessmentProgress;
  questions: SstAssessmentQuestion[];
  items: Array<{
    scopeKey: string;
    targetKey: string;
    title: string;
    state: string;
    explanation: string;
    authority: SstAssessmentAuthority;
    ruleKeys: string[];
    missingFactKeys: string[];
    professionalReviewRequired: boolean;
    traces: AdaptiveRuleTrace[];
  }>;
  specialistTraces: Array<{
    specialist: 'ADAPTIVE_CONFIGURATION' | 'REGULATORY_CANDIDATE';
    packKey: string;
    packVersion: string;
    packContentHash: string;
    engineVersion: string;
    inputHash: string;
    outputHash: string;
    authority: SstAssessmentAuthority;
  }>;
  semanticInputHash: string;
  semanticOutputHash: string;
};

export class SstAssessmentVersionUnsupportedError extends Error {
  readonly code = 'SST_ASSESSMENT_VERSION_UNSUPPORTED';

  constructor(
    readonly versionKind: 'SCHEMA' | 'CATALOG',
    readonly version: string,
  ) {
    super(`SST_ASSESSMENT_VERSION_UNSUPPORTED:${versionKind}:${version}`);
  }
}

export function resolveSstAssessmentSchema(version: string) {
  if (version !== SST_ASSESSMENT_SCHEMA_VERSION) {
    throw new SstAssessmentVersionUnsupportedError('SCHEMA', version);
  }
  return sstAssessmentSnapshotSchema;
}

export function resolveSstAssessmentCatalog(
  version: string,
): readonly SstAssessmentFactDefinition[] {
  if (version !== SST_ASSESSMENT_CATALOG_VERSION) {
    throw new SstAssessmentVersionUnsupportedError('CATALOG', version);
  }
  return SST_ASSESSMENT_FACT_CATALOG;
}

export function parseSstAssessmentSnapshot(input: unknown): SstAssessmentSnapshot {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error('Invalid assessment snapshot');
  }
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.schemaVersion !== 'string') throw new Error('Missing assessment schema');
  if (typeof candidate.catalogVersion !== 'string') throw new Error('Missing assessment catalog');
  resolveSstAssessmentCatalog(candidate.catalogVersion);
  return resolveSstAssessmentSchema(candidate.schemaVersion).parse(candidate);
}

function canonicalString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalString).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalString(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sstAssessmentContentHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalString(value)).digest('hex')}`;
}

export function normalizeSstAssessmentSnapshot(
  input: SstAssessmentSnapshot,
): SstAssessmentSnapshot {
  const parsed = parseSstAssessmentSnapshot(input);
  const catalog = resolveSstAssessmentCatalog(parsed.catalogVersion);
  const scopes = [...parsed.scopes].sort(
    (left, right) => left.order - right.order || left.scopeKey.localeCompare(right.scopeKey),
  );
  if (new Set(scopes.map(({ scopeKey }) => scopeKey)).size !== scopes.length) {
    throw new Error('Duplicate assessment scope');
  }
  if (scopes.filter(({ kind }) => kind === 'ORGANIZATION').length !== 1) {
    throw new Error('Assessment requires exactly one organization scope');
  }
  const identities = new Set<string>();
  const facts = parsed.facts
    .map((fact) => validateSstAssessmentFact(fact, scopes, catalog))
    .sort(
      (left, right) =>
        left.scopeKey.localeCompare(right.scopeKey) || left.factKey.localeCompare(right.factKey),
    );
  for (const fact of facts) {
    const identity = `${fact.scopeKey}:${fact.factKey}`;
    if (identities.has(identity)) throw new Error(`Duplicate assessment fact: ${identity}`);
    identities.add(identity);
  }
  const workCenterCount = facts.find(
    ({ scopeKey, factKey }) =>
      scopeKey === 'organization' && factKey === 'organization.workCenterCount',
  );
  if (
    workCenterCount?.answerState === 'KNOWN' &&
    workCenterCount.value !== scopes.filter(({ kind }) => kind === 'WORK_CENTER').length
  ) {
    throw new Error('Work-center count differs from canonical scopes');
  }
  return { ...parsed, scopes, facts };
}

export function sstAssessmentSemanticHash(snapshot: SstAssessmentSnapshot): string {
  const normalized = normalizeSstAssessmentSnapshot(snapshot);
  return sstAssessmentContentHash({
    schemaVersion: normalized.schemaVersion,
    catalogVersion: normalized.catalogVersion,
    scopes: normalized.scopes.map(({ scopeKey, kind, order }) => ({ scopeKey, kind, order })),
    facts: normalized.facts.map((fact) => ({
      factKey: fact.factKey,
      scopeKey: fact.scopeKey,
      answerState: fact.answerState,
      ...(fact.answerState === 'KNOWN' ? { value: fact.value } : {}),
    })),
  });
}

export function validateSstAssessmentFact(
  factInput: SstAssessmentFact,
  scopes: SstAssessmentScope[],
  catalog: readonly SstAssessmentFactDefinition[] = SST_ASSESSMENT_FACT_CATALOG,
): SstAssessmentFact {
  const fact = sstAssessmentFactSchema.parse(factInput);
  const definition = catalog.find((item) => item.factKey === fact.factKey);
  if (!definition) throw new Error(`Unknown assessment fact: ${fact.factKey}`);
  const scope = scopes.find((item) => item.scopeKey === fact.scopeKey);
  if (!scope) throw new Error(`Unknown assessment scope: ${fact.scopeKey}`);
  if (scope.kind !== definition.scopeKind)
    throw new Error(`Assessment fact scope mismatch: ${fact.factKey}`);
  if (fact.answerState === 'EXPLICIT_UNKNOWN') {
    if (!definition.unknownAllowed)
      throw new Error(`Explicit unknown is not allowed: ${fact.factKey}`);
    return fact;
  }
  const { value } = fact;
  if (definition.valueType === 'BOOLEAN' && typeof value !== 'boolean')
    throw new Error(`Expected boolean: ${fact.factKey}`);
  if (
    definition.valueType === 'INTEGER' &&
    (typeof value !== 'number' ||
      !Number.isInteger(value) ||
      (definition.min !== undefined && value < definition.min) ||
      (definition.max !== undefined && value > definition.max))
  )
    throw new Error(`Expected bounded integer: ${fact.factKey}`);
  if (
    definition.valueType === 'SHORT_TEXT' &&
    (typeof value !== 'string' ||
      value.trim().length === 0 ||
      value.length > (definition.maxLength ?? 500))
  )
    throw new Error(`Expected text: ${fact.factKey}`);
  if (
    definition.valueType === 'SINGLE_CHOICE' &&
    (typeof value !== 'string' || !definition.choices.some((choice) => choice.value === value))
  )
    throw new Error(`Invalid choice: ${fact.factKey}`);
  if (
    definition.valueType === 'MULTI_CHOICE' &&
    (!Array.isArray(value) ||
      (!definition.allowEmpty && value.length === 0) ||
      value.some(
        (item) =>
          typeof item !== 'string' || !definition.choices.some((choice) => choice.value === item),
      ))
  )
    throw new Error(`Invalid choices: ${fact.factKey}`);
  return fact.answerState === 'KNOWN' && typeof value === 'string'
    ? { ...fact, value: value.trim() }
    : fact.answerState === 'KNOWN' && Array.isArray(value)
      ? { ...fact, value: [...new Set(value)].sort() }
      : fact;
}

export function planSstAssessmentQuestions(
  snapshotInput: SstAssessmentSnapshot,
  options: {
    channel?: 'PUBLIC' | 'AUTHENTICATED';
    specialistQuestions?: Array<{
      scopeKey: string;
      factKey: string;
      whyAsked?: string;
      relatedRuleKeys?: string[];
      relatedTargetKeys?: string[];
    }>;
  } = {},
): SstAssessmentQuestion[] {
  const snapshot = normalizeSstAssessmentSnapshot(snapshotInput);
  const catalog = resolveSstAssessmentCatalog(snapshot.catalogVersion);
  const answered = new Set(snapshot.facts.map((fact) => `${fact.scopeKey}:${fact.factKey}`));
  const promoted = new Map<string, NonNullable<typeof options.specialistQuestions>[number]>();
  for (const question of options.specialistQuestions ?? []) {
    const identity = `${question.scopeKey}:${question.factKey}`;
    const current = promoted.get(identity);
    promoted.set(identity, {
      ...current,
      ...question,
      whyAsked: current?.whyAsked ?? question.whyAsked,
      relatedRuleKeys: [
        ...new Set([...(current?.relatedRuleKeys ?? []), ...(question.relatedRuleKeys ?? [])]),
      ].sort(),
      relatedTargetKeys: [
        ...new Set([...(current?.relatedTargetKeys ?? []), ...(question.relatedTargetKeys ?? [])]),
      ].sort(),
    });
  }
  const knownOrganizationValue = (factKey: string) => {
    const fact = snapshot.facts.find(
      (item) => item.scopeKey === 'organization' && item.factKey === factKey,
    );
    return fact?.answerState === 'KNOWN' ? fact.value : undefined;
  };
  const isRelevant = (scope: SstAssessmentScope, fact: SstAssessmentFactDefinition) => {
    switch (fact.relevancePolicy) {
      case 'ALWAYS':
        return true;
      case 'AFTER_INSPECTION_PRACTICE':
        return (
          knownOrganizationValue('organization.inspectionPractice') !== undefined &&
          knownOrganizationValue('organization.inspectionPractice') !== 'NONE'
        );
      case 'PHYSICAL_OR_HYBRID_WORK_CENTER': {
        const arrangement = snapshot.facts.find(
          (item) =>
            item.scopeKey === scope.scopeKey &&
            item.factKey === 'workCenter.workArrangement' &&
            item.answerState === 'KNOWN',
        );
        return arrangement?.answerState === 'KNOWN' && arrangement.value !== 'REMOTE';
      }
      case 'SPECIALIST_PROMOTED':
        return promoted.has(`${scope.scopeKey}:${fact.factKey}`);
    }
  };
  return snapshot.scopes
    .flatMap((scope) =>
      catalog
        .filter((fact) => fact.scopeKind === scope.kind)
        .map((fact) => ({
          scope,
          fact,
        })),
    )
    .filter(({ scope, fact }) => !answered.has(`${scope.scopeKey}:${fact.factKey}`))
    .filter(({ fact }) => !(options.channel === 'AUTHENTICATED' && fact.authenticatedDerived))
    .filter(({ scope, fact }) => isRelevant(scope, fact))
    .sort(
      (left, right) =>
        left.fact.order - right.fact.order ||
        left.scope.order - right.scope.order ||
        left.fact.factKey.localeCompare(right.fact.factKey),
    )
    .map(({ scope, fact }) => {
      const specialist = promoted.get(`${scope.scopeKey}:${fact.factKey}`);
      return {
        questionId: `${scope.scopeKey}:${fact.factKey}`,
        factKey: fact.factKey,
        scopeKey: scope.scopeKey,
        topic: fact.topic,
        valueType: fact.valueType,
        unknownAllowed: fact.unknownAllowed,
        questionText: fact.questionText,
        helpText: fact.helpText,
        choices: fact.choices,
        purpose: specialist?.whyAsked ?? fact.purpose,
        order: fact.order,
        sensitivity: fact.sensitivity,
        relatedRuleKeys: specialist?.relatedRuleKeys ?? [],
        relatedTargetKeys: specialist?.relatedTargetKeys ?? [],
        collectionPolicy: fact.collectionPolicy,
        relevancePolicy: fact.relevancePolicy,
        blocking: fact.blocksReadiness,
      };
    });
}

export function resolveSstAssessmentReadiness(
  snapshot: SstAssessmentSnapshot,
  options: Parameters<typeof planSstAssessmentQuestions>[1] = {},
): 'COLLECTING_INFORMATION' | 'DIAGNOSIS_READY' {
  return planSstAssessmentQuestions(snapshot, options).some(({ blocking }) => blocking)
    ? 'COLLECTING_INFORMATION'
    : 'DIAGNOSIS_READY';
}

export function calculateSstAssessmentProgress(
  snapshotInput: SstAssessmentSnapshot,
  options: Parameters<typeof planSstAssessmentQuestions>[1] = {},
): SstAssessmentProgress {
  const snapshot = normalizeSstAssessmentSnapshot(snapshotInput);
  const catalog = resolveSstAssessmentCatalog(snapshot.catalogVersion);
  const pending = planSstAssessmentQuestions(snapshot, options);
  const blockingPending = pending.filter(({ blocking }) => blocking);
  const plannedIdentities = new Set(
    pending.map(({ scopeKey, factKey }) => `${scopeKey}:${factKey}`),
  );
  const promotedIdentities = new Set(
    (options.specialistQuestions ?? []).map(({ scopeKey, factKey }) => `${scopeKey}:${factKey}`),
  );
  const knownOrganizationValue = (factKey: string) => {
    const fact = snapshot.facts.find(
      (item) => item.scopeKey === 'organization' && item.factKey === factKey,
    );
    return fact?.answerState === 'KNOWN' ? fact.value : undefined;
  };
  const isAnsweredFactRelevant = (fact: SstAssessmentFact) => {
    const definition = catalog.find(({ factKey }) => factKey === fact.factKey);
    if (!definition) return false;
    switch (definition.relevancePolicy) {
      case 'ALWAYS':
        return true;
      case 'AFTER_INSPECTION_PRACTICE':
        return (
          knownOrganizationValue('organization.inspectionPractice') !== undefined &&
          knownOrganizationValue('organization.inspectionPractice') !== 'NONE'
        );
      case 'PHYSICAL_OR_HYBRID_WORK_CENTER': {
        const arrangement = snapshot.facts.find(
          (candidate) =>
            candidate.scopeKey === fact.scopeKey &&
            candidate.factKey === 'workCenter.workArrangement' &&
            candidate.answerState === 'KNOWN',
        );
        return arrangement?.answerState === 'KNOWN' && arrangement.value !== 'REMOTE';
      }
      case 'SPECIALIST_PROMOTED':
        return promotedIdentities.has(`${fact.scopeKey}:${fact.factKey}`);
    }
  };
  const relevantIdentities = new Set([
    ...plannedIdentities,
    ...snapshot.facts.flatMap((fact) =>
      isAnsweredFactRelevant(fact) ? [`${fact.scopeKey}:${fact.factKey}`] : [],
    ),
  ]);
  const questions = snapshot.scopes.flatMap((scope) =>
    catalog
      .filter(
        (fact) =>
          fact.scopeKind === scope.kind &&
          relevantIdentities.has(`${scope.scopeKey}:${fact.factKey}`) &&
          !(options.channel === 'AUTHENTICATED' && fact.authenticatedDerived),
      )
      .map((fact) => ({ scope, fact })),
  );
  const answered = new Set(snapshot.facts.map((fact) => `${fact.scopeKey}:${fact.factKey}`));
  const topicMap = new Map<string, { answered: number; total: number }>();
  for (const { scope, fact } of questions) {
    const current = topicMap.get(fact.topic) ?? { answered: 0, total: 0 };
    current.total += 1;
    if (answered.has(`${scope.scopeKey}:${fact.factKey}`)) current.answered += 1;
    topicMap.set(fact.topic, current);
  }
  const topics = [...topicMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([topic, values]) => ({ topic, ...values, complete: values.answered === values.total }));
  return {
    answeredFacts: questions.filter(({ scope, fact }) =>
      answered.has(`${scope.scopeKey}:${fact.factKey}`),
    ).length,
    resolvedFactCount: snapshot.facts.filter(({ answerState }) => answerState === 'KNOWN').length,
    explicitUnknownCount: snapshot.facts.filter(
      ({ answerState }) => answerState === 'EXPLICIT_UNKNOWN',
    ).length,
    pendingQuestionCount: blockingPending.length,
    totalFacts: questions.length,
    completedTopics: topics.filter((topic) => topic.complete).length,
    totalTopics: topics.length,
    topics,
  };
}
