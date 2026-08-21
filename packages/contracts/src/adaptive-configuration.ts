import { createHash } from 'node:crypto';
import { z } from 'zod';

export const ADAPTIVE_ENGINE_VERSION = '1.0.0' as const;
export const ADAPTIVE_LIMITS = {
  expressionDepth: 5,
  clausesPerExpression: 20,
  predicatesPerPack: 500,
  rulesPerPack: 200,
  groupsPerPack: 30,
  factVersionsPerPack: 100,
  targetVersionsPerPack: 100,
  scopesPerEvaluation: 101,
  factsPerEvaluation: 2_000,
  questionsPerRun: 100,
  answersPerRequest: 100,
  workCentersPerSession: 100,
  evaluationRunsPerSession: 100,
} as const;

export class AdaptiveLimitExceededError extends Error {
  readonly code = 'ADAPTIVE_LIMIT_EXCEEDED';

  constructor(readonly limit: keyof typeof ADAPTIVE_LIMITS) {
    super(`ADAPTIVE_LIMIT_EXCEEDED:${limit}`);
  }
}
export const ADAPTIVE_DEMO_DISCLAIMER =
  'Reglas sintéticas de demostración. No representan normativa ecuatoriana ni acreditan cumplimiento legal.';

export const ADAPTIVE_FACT_VALUE_TYPES = [
  'BOOLEAN',
  'INTEGER',
  'DECIMAL',
  'SHORT_TEXT',
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
] as const;
export const ADAPTIVE_FACT_COLLECTION_MODES = [
  'DERIVED_ONLY',
  'USER_ASKABLE',
  'DERIVED_OR_USER',
  'CONTEXT_ONLY',
] as const;
export const ADAPTIVE_SCOPE_KINDS = ['ORGANIZATION', 'WORK_CENTER'] as const;
export const ADAPTIVE_STATES = [
  'MANDATORY',
  'RECOMMENDED',
  'OPTIONAL',
  'NOT_APPLICABLE',
  'NEEDS_INFORMATION',
  'NEEDS_EXPERT_REVIEW',
] as const;
export const ADAPTIVE_DEPTHS = ['BASIC_VISIBLE', 'TECHNICAL', 'SYSTEMIC', 'UNDETERMINED'] as const;
export const ADAPTIVE_CURRENT_STATES = [
  'UNKNOWN',
  'NOT_IMPLEMENTED',
  'PLANNED',
  'IN_PROGRESS',
  'PARTIALLY_IMPLEMENTED',
  'IMPLEMENTED',
] as const;
export const ADAPTIVE_EVIDENCE_TYPES = ['NOTE', 'EXTERNAL_LINK'] as const;
export const ADAPTIVE_EVIDENCE_SUGGESTIONS = [
  'DOCUMENT',
  'RECORD',
  'TRAINING',
  'PHOTO',
  'MEASUREMENT',
  'INSPECTION',
  'CERTIFICATE',
  'CONTRACT',
  'FIELD_OBSERVATION',
  'OTHER',
] as const;

export type AdaptiveFactValueType = (typeof ADAPTIVE_FACT_VALUE_TYPES)[number];
export type AdaptiveFactCollectionMode = (typeof ADAPTIVE_FACT_COLLECTION_MODES)[number];
export type AdaptiveScopeKind = (typeof ADAPTIVE_SCOPE_KINDS)[number];
export type AdaptiveState = (typeof ADAPTIVE_STATES)[number];
export type AdaptiveDepth = (typeof ADAPTIVE_DEPTHS)[number];
export type AdaptiveCurrentState = (typeof ADAPTIVE_CURRENT_STATES)[number];
export type AdaptiveEvidenceType = (typeof ADAPTIVE_EVIDENCE_TYPES)[number];
export type AdaptiveTruth = 'TRUE' | 'FALSE' | 'MISSING';
export type AdaptiveFactValue = boolean | number | string | string[];

const keySchema = z.string().regex(/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/);
const stableKeySchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,119}$/);
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

export const adaptiveFactVersionSchema = z
  .object({
    factKey: keySchema,
    version: versionSchema,
    category: z.enum([
      'ORGANIZATION_PROFILE',
      'WORKFORCE',
      'WORK_CENTER_CONTEXT',
      'INFRASTRUCTURE',
      'OPERATION',
      'HIGH_RISK_WORK',
      'CONTRACTORS',
      'ACTIVITY',
      'STRATEGIC_PRIORITY',
      'OTHER',
    ]),
    defaultScope: z.enum(ADAPTIVE_SCOPE_KINDS),
    valueType: z.enum(ADAPTIVE_FACT_VALUE_TYPES),
    questionText: z.string().trim().min(1).max(240),
    helpText: z.string().trim().max(500),
    unknownAllowed: z.boolean(),
    collectionMode: z.enum(ADAPTIVE_FACT_COLLECTION_MODES),
    choices: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    maxLength: z.number().int().min(1).max(500).optional(),
    priority: z.number().int().min(0).max(10_000),
  })
  .strict()
  .superRefine((fact, context) => {
    const choiceType = fact.valueType === 'SINGLE_CHOICE' || fact.valueType === 'MULTI_CHOICE';
    if (choiceType !== fact.choices.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['choices'],
        message: 'Choice facts require choices',
      });
    }
    if (fact.collectionMode === 'CONTEXT_ONLY' && fact.category !== 'STRATEGIC_PRIORITY') {
      context.addIssue({
        code: 'custom',
        path: ['collectionMode'],
        message: 'V1 context-only facts are reserved for strategic priorities',
      });
    }
  });
export type AdaptiveFactVersionContract = z.infer<typeof adaptiveFactVersionSchema>;

export const adaptiveTargetVersionSchema = z
  .object({
    targetKey: stableKeySchema,
    version: versionSchema,
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(500),
    category: z.enum([
      'GOVERNANCE',
      'EMERGENCY_PREPAREDNESS',
      'WORKPLACE_CONDITIONS',
      'HEALTH_MANAGEMENT',
      'HIGH_RISK_WORK',
      'CONTRACTOR_COORDINATION',
      'INSPECTION',
      'TRAINING',
      'DOCUMENTATION',
      'PROFESSIONAL_REVIEW',
      'OTHER',
    ]),
    currentStateQuestion: z.string().trim().min(1).max(240),
    evidenceSuggestions: z.array(z.enum(ADAPTIVE_EVIDENCE_SUGGESTIONS)).max(10),
    isDemo: z.boolean(),
  })
  .strict();
export type AdaptiveTargetVersionContract = z.infer<typeof adaptiveTargetVersionSchema>;

const adaptivePredicateSchema = z
  .object({
    kind: z.literal('PREDICATE'),
    factKey: keySchema,
    factScope: z.enum(['CURRENT_SCOPE', 'ORGANIZATION']),
    operator: z.enum([
      'EQUALS',
      'NOT_EQUALS',
      'IN',
      'NOT_IN',
      'NUMBER_GTE',
      'NUMBER_LTE',
      'BOOLEAN_IS',
      'EXISTS',
    ]),
    value: z
      .union([z.boolean(), z.number().finite(), z.string(), z.array(z.string()).min(1)])
      .optional(),
  })
  .strict();

export type AdaptivePredicate = z.infer<typeof adaptivePredicateSchema>;
export type AdaptiveExpression =
  AdaptivePredicate | { kind: 'GROUP'; mode: 'ALL' | 'ANY'; clauses: AdaptiveExpression[] };

export const adaptiveExpressionSchema: z.ZodType<AdaptiveExpression> = z.lazy(() =>
  z.union([
    adaptivePredicateSchema,
    z
      .object({
        kind: z.literal('GROUP'),
        mode: z.enum(['ALL', 'ANY']),
        clauses: z.array(adaptiveExpressionSchema).min(1).max(ADAPTIVE_LIMITS.clausesPerExpression),
      })
      .strict(),
  ]),
);

export const adaptiveRuleVersionSchema = z
  .object({
    ruleKey: stableKeySchema,
    version: versionSchema,
    groupKey: stableKeySchema,
    scopeMode: z.enum(['ORGANIZATION', 'EACH_WORK_CENTER']),
    condition: adaptiveExpressionSchema,
    targetKey: stableKeySchema,
    state: z.enum(ADAPTIVE_STATES),
    minimumDepth: z.enum(ADAPTIVE_DEPTHS),
    professionalReview: z.boolean(),
    reasonCode: stableKeySchema,
    explanation: z.string().trim().min(1).max(500),
    isDemo: z.boolean(),
    regulatory: z.boolean(),
  })
  .strict();
export type AdaptiveRuleVersionContract = z.infer<typeof adaptiveRuleVersionSchema>;

export const adaptiveRuleGroupVersionSchema = z
  .object({
    groupKey: stableKeySchema,
    version: versionSchema,
    title: z.string().trim().min(1).max(160),
    priority: z.number().int().min(0).max(10_000),
    scopeMode: z.enum(['ORGANIZATION', 'EACH_WORK_CENTER']),
    activation: adaptiveExpressionSchema,
    ruleKeys: z.array(stableKeySchema).min(1).max(ADAPTIVE_LIMITS.rulesPerPack),
    isDemo: z.boolean(),
    regulatory: z.boolean(),
  })
  .strict();
export type AdaptiveRuleGroupVersionContract = z.infer<typeof adaptiveRuleGroupVersionSchema>;

export const adaptiveRulePackSchema = z
  .object({
    packKey: stableKeySchema,
    version: versionSchema,
    engineSchemaVersion: z.literal(ADAPTIVE_ENGINE_VERSION),
    name: z.string().trim().min(1).max(160),
    isDemo: z.boolean(),
    regulatory: z.boolean(),
    disclaimer: z.string().trim().min(1).max(500),
    factVersions: z
      .array(adaptiveFactVersionSchema)
      .min(1)
      .max(ADAPTIVE_LIMITS.factVersionsPerPack),
    targetVersions: z
      .array(adaptiveTargetVersionSchema)
      .min(1)
      .max(ADAPTIVE_LIMITS.targetVersionsPerPack),
    groups: z.array(adaptiveRuleGroupVersionSchema).min(1).max(ADAPTIVE_LIMITS.groupsPerPack),
    rules: z.array(adaptiveRuleVersionSchema).min(1).max(ADAPTIVE_LIMITS.rulesPerPack),
  })
  .strict()
  .superRefine((pack, context) => {
    if (pack.isDemo === pack.regulatory) {
      context.addIssue({
        code: 'custom',
        path: ['isDemo'],
        message: 'Pack must be DEMO or regulatory',
      });
    }
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (!unique(pack.factVersions.map((fact) => fact.factKey)))
      context.addIssue({ code: 'custom', path: ['factVersions'], message: 'Duplicate fact key' });
    if (!unique(pack.targetVersions.map((target) => target.targetKey)))
      context.addIssue({
        code: 'custom',
        path: ['targetVersions'],
        message: 'Duplicate target key',
      });
    if (!unique(pack.groups.map((group) => group.groupKey)))
      context.addIssue({ code: 'custom', path: ['groups'], message: 'Duplicate group key' });
    if (!unique(pack.rules.map((rule) => rule.ruleKey)))
      context.addIssue({ code: 'custom', path: ['rules'], message: 'Duplicate rule key' });
  });
export type AdaptiveRulePackContract = z.infer<typeof adaptiveRulePackSchema>;

export type AdaptiveScopeInput = {
  scopeId?: string;
  scopeKey: string;
  kind: AdaptiveScopeKind;
  order: number;
  workCenterId?: string;
  displayName: string;
};

export type AdaptiveFactInput = {
  scopeKey: string;
  factKey: string;
  factVersionId?: string;
  source?: string;
  value: AdaptiveFactValue;
};

export type AdaptiveEvaluationAuditContext = {
  packVersionId: string;
  packContentHash: string;
};

export type AdaptivePredicateTrace = {
  factKey: string;
  factScope: 'CURRENT_SCOPE' | 'ORGANIZATION';
  operator: AdaptivePredicate['operator'];
  expected: AdaptivePredicate['value'] | null;
  actual: AdaptiveFactValue | null;
  result: AdaptiveTruth;
};

export type AdaptiveRuleTrace = {
  groupKey: string;
  ruleKey: string;
  ruleVersion: string;
  scopeKey: string;
  result: AdaptiveTruth;
  targetKey: string;
  state: AdaptiveState | null;
  minimumDepth: AdaptiveDepth;
  predicates: AdaptivePredicateTrace[];
};

export type AdaptiveGeneratedQuestionResult = {
  scopeKey: string;
  factKey: string;
  questionText: string;
  helpText: string;
  valueType: AdaptiveFactValueType;
  unknownAllowed: boolean;
  choices: string[];
  whyAsked: string;
  relatedRuleKeys: string[];
  relatedTargetKeys: string[];
  groupPriority: number;
  factPriority: number;
};

export type AdaptiveConfigurationItemResult = {
  scopeKey: string;
  targetKey: string;
  title: string;
  description: string;
  state: AdaptiveState;
  minimumDepth: AdaptiveDepth;
  professionalReview: boolean;
  reason: string;
  ruleKeys: string[];
  missingFactKeys: string[];
  evidenceSuggestions: string[];
  traces: AdaptiveRuleTrace[];
};

export type AdaptiveEvaluationResult = {
  engineVersion: typeof ADAPTIVE_ENGINE_VERSION;
  groups: Array<{ groupKey: string; scopeKey: string; result: AdaptiveTruth }>;
  ruleTraces: AdaptiveRuleTrace[];
  questions: AdaptiveGeneratedQuestionResult[];
  items: AdaptiveConfigurationItemResult[];
  missingFacts: Array<{ scopeKey: string; factKey: string }>;
  inputHash: string;
  outputHash: string;
};

const statePrecedence: Record<AdaptiveState, number> = {
  NEEDS_EXPERT_REVIEW: 60,
  MANDATORY: 50,
  NEEDS_INFORMATION: 40,
  RECOMMENDED: 30,
  OPTIONAL: 20,
  NOT_APPLICABLE: 10,
};
const depthPrecedence: Record<AdaptiveDepth, number> = {
  SYSTEMIC: 40,
  TECHNICAL: 30,
  BASIC_VISIBLE: 20,
  UNDETERMINED: 10,
};

function canonicalString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalString).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalString(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function adaptiveContentHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalString(value)).digest('hex')}`;
}

function canonicalOrder<T>(values: T[]): T[] {
  return [...values].sort((left, right) =>
    canonicalString(left).localeCompare(canonicalString(right)),
  );
}

export function normalizeAdaptiveExpression(expression: AdaptiveExpression): AdaptiveExpression {
  if (expression.kind === 'PREDICATE') return { ...expression };
  return {
    kind: 'GROUP',
    mode: expression.mode,
    clauses: canonicalOrder(expression.clauses.map(normalizeAdaptiveExpression)),
  };
}

export function normalizeAdaptiveRuleVersion(
  rule: AdaptiveRuleVersionContract,
): AdaptiveRuleVersionContract {
  return { ...rule, condition: normalizeAdaptiveExpression(rule.condition) };
}

export function normalizeAdaptiveGroupVersion(
  group: AdaptiveRuleGroupVersionContract,
): AdaptiveRuleGroupVersionContract {
  return {
    ...group,
    activation: normalizeAdaptiveExpression(group.activation),
    ruleKeys: [...group.ruleKeys].sort(),
  };
}

export function normalizeAdaptivePackVersion(
  pack: AdaptiveRulePackContract,
): AdaptiveRulePackContract {
  return {
    ...pack,
    factVersions: [...pack.factVersions].sort((left, right) =>
      `${left.factKey}:${left.version}`.localeCompare(`${right.factKey}:${right.version}`),
    ),
    targetVersions: [...pack.targetVersions]
      .map((target) => ({
        ...target,
        evidenceSuggestions: [...target.evidenceSuggestions].sort(),
      }))
      .sort((left, right) =>
        `${left.targetKey}:${left.version}`.localeCompare(`${right.targetKey}:${right.version}`),
      ),
    rules: pack.rules
      .map(normalizeAdaptiveRuleVersion)
      .sort((left, right) =>
        `${left.ruleKey}:${left.version}`.localeCompare(`${right.ruleKey}:${right.version}`),
      ),
    groups: pack.groups
      .map(normalizeAdaptiveGroupVersion)
      .sort((left, right) =>
        `${left.groupKey}:${left.version}`.localeCompare(`${right.groupKey}:${right.version}`),
      ),
  };
}

export type AdaptivePackVersionIdentities = {
  factVersions: Array<{ id: string; factKey: string; version: string }>;
  targetVersions: Array<{ id: string; targetKey: string; version: string }>;
  ruleVersions: Array<{ id: string; ruleKey: string; version: string }>;
  groupVersions: Array<{ id: string; groupKey: string; version: string }>;
};

export function adaptivePackContentHash(
  pack: AdaptiveRulePackContract,
  identities?: AdaptivePackVersionIdentities,
): string {
  return adaptiveContentHash({
    pack: normalizeAdaptivePackVersion(pack),
    identities: identities
      ? {
          factVersions: canonicalOrder(identities.factVersions),
          targetVersions: canonicalOrder(identities.targetVersions),
          ruleVersions: canonicalOrder(identities.ruleVersions),
          groupVersions: canonicalOrder(identities.groupVersions),
        }
      : null,
  });
}

function normalizeEvaluationInput(input: {
  pack: AdaptiveRulePackContract;
  scopes: AdaptiveScopeInput[];
  facts: AdaptiveFactInput[];
  auditContext?: AdaptiveEvaluationAuditContext;
}) {
  const factVersions = new Map(input.pack.factVersions.map((fact) => [fact.factKey, fact.version]));
  return {
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    pack: {
      packKey: input.pack.packKey,
      version: input.pack.version,
      packVersionId: input.auditContext?.packVersionId ?? null,
      contentHash: input.auditContext?.packContentHash ?? adaptivePackContentHash(input.pack),
    },
    scopes: canonicalOrder(
      input.scopes.map((scope) => ({
        scopeId: scope.scopeId ?? null,
        scopeKey: scope.scopeKey,
        kind: scope.kind,
        order: scope.order,
        workCenterId: scope.workCenterId ?? null,
        displayName: scope.displayName,
      })),
    ),
    facts: canonicalOrder(
      input.facts.map((fact) => ({
        scopeKey: fact.scopeKey,
        factKey: fact.factKey,
        factVersionId: fact.factVersionId ?? null,
        factVersion: factVersions.get(fact.factKey) ?? null,
        source: fact.source ?? null,
        value: fact.value,
      })),
    ),
  };
}

function normalizeRuleTrace(trace: AdaptiveRuleTrace): AdaptiveRuleTrace {
  return {
    ...trace,
    predicates: canonicalOrder(trace.predicates),
  };
}

function normalizeEvaluationOutput(
  output: Omit<AdaptiveEvaluationResult, 'inputHash' | 'outputHash'>,
) {
  return {
    engineVersion: output.engineVersion,
    groups: canonicalOrder(output.groups),
    ruleTraces: canonicalOrder(output.ruleTraces.map(normalizeRuleTrace)),
    questions: output.questions.map((question) => ({
      ...question,
      relatedRuleKeys: [...question.relatedRuleKeys].sort(),
      relatedTargetKeys: [...question.relatedTargetKeys].sort(),
    })),
    items: canonicalOrder(
      output.items.map((item) => ({
        ...item,
        ruleKeys: [...item.ruleKeys].sort(),
        missingFactKeys: [...item.missingFactKeys].sort(),
        evidenceSuggestions: [...item.evidenceSuggestions].sort(),
        traces: canonicalOrder(item.traces.map(normalizeRuleTrace)),
      })),
    ),
    missingFacts: canonicalOrder(output.missingFacts),
  };
}

export function validateAdaptiveFactValue(
  fact: AdaptiveFactVersionContract,
  value: unknown,
): AdaptiveFactValue {
  if (value === undefined || value === null || value === '') throw new Error('Unanswered fact');
  switch (fact.valueType) {
    case 'BOOLEAN':
      if (typeof value !== 'boolean') throw new Error('Expected boolean');
      return value;
    case 'INTEGER':
      if (typeof value !== 'number' || !Number.isInteger(value))
        throw new Error('Expected integer');
      break;
    case 'DECIMAL':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Expected decimal');
      break;
    case 'SHORT_TEXT':
      if (typeof value !== 'string' || value.trim().length === 0) throw new Error('Expected text');
      if (value.length > (fact.maxLength ?? 240)) throw new Error('Text too long');
      return value.trim();
    case 'SINGLE_CHOICE':
      if (typeof value !== 'string' || !fact.choices.includes(value))
        throw new Error('Invalid choice');
      return value;
    case 'MULTI_CHOICE':
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
        throw new Error('Expected choices');
      if (value.some((item) => !fact.choices.includes(item as string)))
        throw new Error('Invalid choice');
      return [...new Set(value as string[])].sort();
  }
  if (typeof value !== 'number') throw new Error('Expected number');
  if (fact.min !== undefined && value < fact.min) throw new Error('Value below minimum');
  if (fact.max !== undefined && value > fact.max) throw new Error('Value above maximum');
  return value;
}

type ExpressionResult = {
  result: AdaptiveTruth;
  traces: AdaptivePredicateTrace[];
  relevantMissing: string[];
};

function evaluatePredicate(
  predicate: AdaptivePredicate,
  scope: AdaptiveScopeInput,
  factMap: Map<string, AdaptiveFactValue>,
): ExpressionResult {
  const targetScope = predicate.factScope === 'ORGANIZATION' ? 'organization' : scope.scopeKey;
  const actual = factMap.get(`${targetScope}:${predicate.factKey}`);
  if (actual === undefined) {
    return {
      result: 'MISSING',
      relevantMissing: [predicate.factKey],
      traces: [
        { ...predicate, expected: predicate.value ?? null, actual: null, result: 'MISSING' },
      ],
    };
  }
  let matches = false;
  switch (predicate.operator) {
    case 'EXISTS':
      matches = true;
      break;
    case 'EQUALS':
    case 'BOOLEAN_IS':
      matches = actual === predicate.value;
      break;
    case 'NOT_EQUALS':
      matches = actual !== predicate.value;
      break;
    case 'IN':
      matches = Array.isArray(predicate.value) && predicate.value.includes(actual as never);
      break;
    case 'NOT_IN':
      matches = Array.isArray(predicate.value) && !predicate.value.includes(actual as never);
      break;
    case 'NUMBER_GTE':
      matches =
        typeof actual === 'number' &&
        typeof predicate.value === 'number' &&
        actual >= predicate.value;
      break;
    case 'NUMBER_LTE':
      matches =
        typeof actual === 'number' &&
        typeof predicate.value === 'number' &&
        actual <= predicate.value;
      break;
  }
  const result: AdaptiveTruth = matches ? 'TRUE' : 'FALSE';
  return {
    result,
    relevantMissing: [],
    traces: [{ ...predicate, expected: predicate.value ?? null, actual, result }],
  };
}

function evaluateExpression(
  expression: AdaptiveExpression,
  scope: AdaptiveScopeInput,
  factMap: Map<string, AdaptiveFactValue>,
  depth = 1,
): ExpressionResult {
  if (depth > ADAPTIVE_LIMITS.expressionDepth)
    throw new AdaptiveLimitExceededError('expressionDepth');
  if (expression.kind === 'PREDICATE') return evaluatePredicate(expression, scope, factMap);
  const children = expression.clauses.map((clause) =>
    evaluateExpression(clause, scope, factMap, depth + 1),
  );
  const traces = children.flatMap((child) => child.traces);
  if (expression.mode === 'ALL') {
    if (children.some((child) => child.result === 'FALSE'))
      return { result: 'FALSE', traces, relevantMissing: [] };
    if (children.every((child) => child.result === 'TRUE'))
      return { result: 'TRUE', traces, relevantMissing: [] };
  } else {
    if (children.some((child) => child.result === 'TRUE'))
      return { result: 'TRUE', traces, relevantMissing: [] };
    if (children.every((child) => child.result === 'FALSE'))
      return { result: 'FALSE', traces, relevantMissing: [] };
  }
  return {
    result: 'MISSING',
    traces,
    relevantMissing: [...new Set(children.flatMap((child) => child.relevantMissing))].sort(),
  };
}

function factCanAffectRules(fact: AdaptiveFactVersionContract) {
  return fact.collectionMode !== 'CONTEXT_ONLY';
}

function buildAdaptiveWhyAsked(input: {
  groupTitles: string[];
  isDemo: boolean;
  regulatory: boolean;
}) {
  if (input.isDemo && !input.regulatory)
    return `Ayuda a resolver ${input.groupTitles.join(', ')} dentro de esta propuesta DEMO.`;
  if (!input.isDemo && input.regulatory)
    return 'Esta pregunta es necesaria para completar una evaluación regulatoria del pack seleccionado.';
  throw new Error('Invalid adaptive pack boundary');
}

export function validateAdaptivePack(
  packInput: AdaptiveRulePackContract,
): AdaptiveRulePackContract {
  const parsed = adaptiveRulePackSchema.parse(packInput);
  const pack = {
    ...parsed,
    rules: parsed.rules.map(normalizeAdaptiveRuleVersion),
    groups: parsed.groups.map(normalizeAdaptiveGroupVersion),
  };
  const facts = new Map(pack.factVersions.map((fact) => [fact.factKey, fact]));
  const targets = new Set(pack.targetVersions.map((target) => target.targetKey));
  const rules = new Map(pack.rules.map((rule) => [rule.ruleKey, rule]));
  let predicateCount = 0;
  const visit = (
    expression: AdaptiveExpression,
    scopeMode: AdaptiveRuleGroupVersionContract['scopeMode'],
    stackDepth = 1,
  ) => {
    if (stackDepth > ADAPTIVE_LIMITS.expressionDepth)
      throw new AdaptiveLimitExceededError('expressionDepth');
    if (expression.kind === 'PREDICATE') {
      predicateCount += 1;
      const fact = facts.get(expression.factKey);
      if (!fact) throw new Error(`Unknown fact ${expression.factKey}`);
      if (!factCanAffectRules(fact))
        throw new Error(`Context-only fact cannot affect rules: ${fact.factKey}`);
      if (
        (fact.defaultScope === 'ORGANIZATION' && expression.factScope !== 'ORGANIZATION') ||
        (fact.defaultScope === 'WORK_CENTER' &&
          (expression.factScope !== 'CURRENT_SCOPE' || scopeMode !== 'EACH_WORK_CENTER'))
      )
        throw new Error(`Fact scope mismatch: ${fact.factKey}`);
      return;
    }
    expression.clauses.forEach((clause) => visit(clause, scopeMode, stackDepth + 1));
  };
  for (const group of pack.groups) {
    visit(group.activation, group.scopeMode);
    for (const ruleKey of group.ruleKeys)
      if (!rules.has(ruleKey)) throw new Error(`Unknown rule ${ruleKey}`);
  }
  for (const rule of pack.rules) {
    visit(rule.condition, rule.scopeMode);
    if (!targets.has(rule.targetKey)) throw new Error(`Unknown target ${rule.targetKey}`);
  }
  if (
    pack.rules.some((rule) => rule.isDemo !== pack.isDemo || rule.regulatory !== pack.regulatory) ||
    pack.groups.some(
      (group) => group.isDemo !== pack.isDemo || group.regulatory !== pack.regulatory,
    ) ||
    pack.targetVersions.some((target) => target.isDemo !== pack.isDemo)
  )
    throw new Error('Pack contains boundary-incompatible content');
  if (predicateCount > ADAPTIVE_LIMITS.predicatesPerPack)
    throw new AdaptiveLimitExceededError('predicatesPerPack');
  return pack;
}

export function evaluateAdaptiveConfiguration(input: {
  pack: AdaptiveRulePackContract;
  scopes: AdaptiveScopeInput[];
  facts: AdaptiveFactInput[];
  auditContext?: AdaptiveEvaluationAuditContext;
}): AdaptiveEvaluationResult {
  const pack = validateAdaptivePack(input.pack);
  if (input.scopes.length > ADAPTIVE_LIMITS.scopesPerEvaluation)
    throw new AdaptiveLimitExceededError('scopesPerEvaluation');
  if (input.facts.length > ADAPTIVE_LIMITS.factsPerEvaluation)
    throw new AdaptiveLimitExceededError('factsPerEvaluation');
  const scopes = [...input.scopes].sort(
    (left, right) => left.order - right.order || left.scopeKey.localeCompare(right.scopeKey),
  );
  const factMap = new Map(
    input.facts.map((fact) => [`${fact.scopeKey}:${fact.factKey}`, fact.value]),
  );
  const factCatalog = new Map(pack.factVersions.map((fact) => [fact.factKey, fact]));
  const targets = new Map(pack.targetVersions.map((target) => [target.targetKey, target]));
  const rules = new Map(pack.rules.map((rule) => [rule.ruleKey, rule]));
  const groups: AdaptiveEvaluationResult['groups'] = [];
  const traces: AdaptiveRuleTrace[] = [];
  const questionNeeds = new Map<
    string,
    {
      scope: AdaptiveScopeInput;
      fact: AdaptiveFactVersionContract;
      groups: Set<string>;
      rules: Set<string>;
      targets: Set<string>;
      priority: number;
    }
  >();

  const addQuestion = (
    scope: AdaptiveScopeInput,
    factKey: string,
    group: AdaptiveRuleGroupVersionContract,
    rule?: AdaptiveRuleVersionContract,
  ) => {
    const fact = factCatalog.get(factKey);
    if (!fact || fact.collectionMode === 'DERIVED_ONLY' || fact.collectionMode === 'CONTEXT_ONLY')
      return;
    const questionScope =
      fact.defaultScope === 'ORGANIZATION'
        ? scopes.find((item) => item.kind === 'ORGANIZATION')
        : scope;
    if (!questionScope) return;
    const key = `${questionScope.scopeKey}:${fact.factKey}`;
    const existing = questionNeeds.get(key) ?? {
      scope: questionScope,
      fact,
      groups: new Set<string>(),
      rules: new Set<string>(),
      targets: new Set<string>(),
      priority: group.priority,
    };
    existing.groups.add(group.title);
    if (rule) {
      existing.rules.add(rule.ruleKey);
      existing.targets.add(rule.targetKey);
    }
    existing.priority = Math.min(existing.priority, group.priority);
    questionNeeds.set(key, existing);
  };

  for (const group of [...pack.groups].sort(
    (left, right) => left.priority - right.priority || left.groupKey.localeCompare(right.groupKey),
  )) {
    const candidateScopes =
      group.scopeMode === 'ORGANIZATION'
        ? scopes.filter((scope) => scope.kind === 'ORGANIZATION')
        : scopes.filter((scope) => scope.kind === 'WORK_CENTER');
    for (const scope of candidateScopes) {
      const activation = evaluateExpression(group.activation, scope, factMap);
      groups.push({
        groupKey: group.groupKey,
        scopeKey: scope.scopeKey,
        result: activation.result,
      });
      if (activation.result === 'MISSING') {
        activation.relevantMissing.forEach((factKey) => addQuestion(scope, factKey, group));
        continue;
      }
      if (activation.result === 'FALSE') continue;
      for (const ruleKey of [...group.ruleKeys].sort()) {
        const rule = rules.get(ruleKey)!;
        const result = evaluateExpression(rule.condition, scope, factMap);
        const trace: AdaptiveRuleTrace = {
          groupKey: group.groupKey,
          ruleKey: rule.ruleKey,
          ruleVersion: rule.version,
          scopeKey: scope.scopeKey,
          result: result.result,
          targetKey: rule.targetKey,
          state:
            result.result === 'TRUE'
              ? rule.state
              : result.result === 'MISSING'
                ? 'NEEDS_INFORMATION'
                : null,
          minimumDepth: result.result === 'TRUE' ? rule.minimumDepth : 'UNDETERMINED',
          predicates: result.traces,
        };
        traces.push(trace);
        if (result.result === 'MISSING')
          result.relevantMissing.forEach((factKey) => addQuestion(scope, factKey, group, rule));
      }
    }
  }

  const itemGroups = new Map<string, AdaptiveRuleTrace[]>();
  for (const trace of traces.filter((item) => item.state !== null)) {
    const key = `${trace.scopeKey}:${trace.targetKey}`;
    itemGroups.set(key, [...(itemGroups.get(key) ?? []), trace]);
  }
  const items = [...itemGroups.entries()]
    .map(([, itemTraces]): AdaptiveConfigurationItemResult => {
      const firstTrace = itemTraces[0];
      if (!firstTrace) throw new Error('Adaptive item requires a contribution');
      const { scopeKey, targetKey } = firstTrace;
      const target = targets.get(targetKey)!;
      const ordered = [...itemTraces].sort((left, right) => {
        const stateDelta = statePrecedence[right.state!] - statePrecedence[left.state!];
        return stateDelta || left.ruleKey.localeCompare(right.ruleKey);
      });
      const winning = ordered[0]!;
      const depth = [...itemTraces].sort(
        (left, right) =>
          depthPrecedence[right.minimumDepth] - depthPrecedence[left.minimumDepth] ||
          left.ruleKey.localeCompare(right.ruleKey),
      )[0]!.minimumDepth;
      const ruleByKey = new Map(pack.rules.map((rule) => [rule.ruleKey, rule]));
      return {
        scopeKey,
        targetKey,
        title: target.title,
        description: target.description,
        state: winning.state!,
        minimumDepth: depth,
        professionalReview: itemTraces.some(
          (trace) => ruleByKey.get(trace.ruleKey)?.professionalReview,
        ),
        reason: ruleByKey.get(winning.ruleKey)!.explanation,
        ruleKeys: itemTraces.map((trace) => trace.ruleKey).sort(),
        missingFactKeys: [
          ...new Set(
            itemTraces.flatMap((trace) =>
              trace.predicates
                .filter((predicate) => predicate.result === 'MISSING')
                .map((predicate) => predicate.factKey),
            ),
          ),
        ].sort(),
        evidenceSuggestions: target.evidenceSuggestions,
        traces: [...itemTraces].sort((left, right) => left.ruleKey.localeCompare(right.ruleKey)),
      };
    })
    .sort(
      (left, right) =>
        left.scopeKey.localeCompare(right.scopeKey) ||
        left.targetKey.localeCompare(right.targetKey),
    );

  const orderedQuestionNeeds = [...questionNeeds.values()].sort(
    (left, right) =>
      left.priority - right.priority ||
      left.scope.order - right.scope.order ||
      left.fact.priority - right.fact.priority ||
      left.fact.factKey.localeCompare(right.fact.factKey),
  );
  if (orderedQuestionNeeds.length > ADAPTIVE_LIMITS.questionsPerRun)
    throw new AdaptiveLimitExceededError('questionsPerRun');
  const questions = orderedQuestionNeeds.map((need): AdaptiveGeneratedQuestionResult => ({
    scopeKey: need.scope.scopeKey,
    factKey: need.fact.factKey,
    questionText: need.fact.questionText,
    helpText: need.fact.helpText,
    valueType: need.fact.valueType,
    unknownAllowed: need.fact.unknownAllowed,
    choices: need.fact.choices,
    whyAsked: buildAdaptiveWhyAsked({
      groupTitles: [...need.groups].sort(),
      isDemo: pack.isDemo,
      regulatory: pack.regulatory,
    }),
    relatedRuleKeys: [...need.rules].sort(),
    relatedTargetKeys: [...need.targets].sort(),
    groupPriority: need.priority,
    factPriority: need.fact.priority,
  }));
  const missingFacts = questions.map(({ scopeKey, factKey }) => ({ scopeKey, factKey }));
  const base: Omit<AdaptiveEvaluationResult, 'inputHash' | 'outputHash'> = {
    engineVersion: ADAPTIVE_ENGINE_VERSION,
    groups,
    ruleTraces: traces,
    questions,
    items,
    missingFacts,
  };
  return {
    ...base,
    inputHash: adaptiveContentHash(normalizeEvaluationInput({ ...input, pack, scopes })),
    outputHash: adaptiveContentHash(normalizeEvaluationOutput(base)),
  };
}

const fact = (
  factKey: string,
  category: AdaptiveFactVersionContract['category'],
  defaultScope: AdaptiveScopeKind,
  valueType: AdaptiveFactValueType,
  questionText: string,
  options: Partial<AdaptiveFactVersionContract> = {},
): AdaptiveFactVersionContract => ({
  factKey,
  version: '1.0.0',
  category,
  defaultScope,
  valueType,
  questionText,
  helpText:
    options.helpText ??
    'Responde con la información disponible. Puedes indicar que aún no la conoces.',
  unknownAllowed: options.unknownAllowed ?? true,
  collectionMode: options.collectionMode ?? 'USER_ASKABLE',
  choices: options.choices ?? [],
  priority: options.priority ?? 100,
  ...(options.min === undefined ? {} : { min: options.min }),
  ...(options.max === undefined ? {} : { max: options.max }),
  ...(options.maxLength === undefined ? {} : { maxLength: options.maxLength }),
});

export const DEMO_ADAPTIVE_FACT_VERSIONS: AdaptiveFactVersionContract[] = [
  fact(
    'organization.country',
    'ORGANIZATION_PROFILE',
    'ORGANIZATION',
    'SHORT_TEXT',
    '¿En qué país opera la organización?',
    { collectionMode: 'DERIVED_ONLY', maxLength: 120, priority: 1 },
  ),
  fact(
    'organization.sector',
    'ORGANIZATION_PROFILE',
    'ORGANIZATION',
    'SHORT_TEXT',
    '¿Cuál es el sector principal?',
    { collectionMode: 'DERIVED_ONLY', maxLength: 160, priority: 2 },
  ),
  fact(
    'organization.totalWorkerCount',
    'WORKFORCE',
    'ORGANIZATION',
    'INTEGER',
    '¿Cuántas personas trabajan en total?',
    { collectionMode: 'DERIVED_ONLY', min: 1, max: 10_000_000, priority: 3 },
  ),
  fact(
    'organization.workCenterCount',
    'ORGANIZATION_PROFILE',
    'ORGANIZATION',
    'INTEGER',
    '¿Cuántos centros de trabajo existen?',
    { collectionMode: 'DERIVED_ONLY', min: 0, max: 100_000, priority: 4 },
  ),
  fact(
    'organization.strategicProtectionPriorities',
    'STRATEGIC_PRIORITY',
    'ORGANIZATION',
    'MULTI_CHOICE',
    '¿Qué aspectos desea proteger prioritariamente?',
    {
      collectionMode: 'CONTEXT_ONLY',
      choices: [
        'PEOPLE_AND_HEALTH',
        'PRODUCTIVE_CONTINUITY',
        'BUSINESS_CONTINUITY',
        'MACHINERY_AND_INFRASTRUCTURE',
        'FINANCIAL_IMPACT',
        'REPUTATION',
        'CONTRACTORS_AND_SUPPLY_CHAIN',
        'PRODUCT_OR_SERVICE_QUALITY',
      ],
      priority: 900,
    },
  ),
  fact(
    'workCenter.workerCount',
    'WORKFORCE',
    'WORK_CENTER',
    'INTEGER',
    '¿Cuántas personas trabajan habitualmente en este centro?',
    { collectionMode: 'DERIVED_OR_USER', min: 0, max: 10_000_000, priority: 20 },
  ),
  fact(
    'workCenter.activityCategory',
    'ACTIVITY',
    'WORK_CENTER',
    'SINGLE_CHOICE',
    '¿Cuál describe mejor la actividad principal de este centro?',
    {
      choices: [
        'ADMINISTRATIVE_SERVICES',
        'PRODUCTION',
        'WAREHOUSE',
        'CONSTRUCTION_ASSEMBLY',
        'OTHER_AMBIGUOUS',
      ],
      priority: 21,
    },
  ),
  fact(
    'workCenter.activityDescription',
    'ACTIVITY',
    'WORK_CENTER',
    'SHORT_TEXT',
    '¿Qué actividad realiza exactamente este centro?',
    { maxLength: 300, priority: 22 },
  ),
  fact(
    'workCenter.workArrangement',
    'WORK_CENTER_CONTEXT',
    'WORK_CENTER',
    'SINGLE_CHOICE',
    '¿Cómo trabaja principalmente este centro?',
    { choices: ['PHYSICAL', 'REMOTE', 'HYBRID'], priority: 10 },
  ),
  fact(
    'workCenter.facilityType',
    'INFRASTRUCTURE',
    'WORK_CENTER',
    'SINGLE_CHOICE',
    '¿Este centro funciona como oficina, planta, bodega u otro tipo de instalación?',
    { choices: ['OFFICE', 'PLANT', 'WAREHOUSE', 'CONSTRUCTION_SITE', 'OTHER'], priority: 30 },
  ),
  fact(
    'workCenter.hasDistinctOperationalZones',
    'INFRASTRUCTURE',
    'WORK_CENTER',
    'BOOLEAN',
    '¿El centro tiene zonas operativas claramente distintas?',
    { priority: 31 },
  ),
  fact(
    'workCenter.hasChemicalProcesses',
    'OPERATION',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existen procesos químicos?',
    { collectionMode: 'DERIVED_OR_USER', priority: 40 },
  ),
  fact(
    'workCenter.hasHighEnergyOperations',
    'OPERATION',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro existen operaciones de alta energía?',
    { collectionMode: 'DERIVED_OR_USER', priority: 41 },
  ),
  fact(
    'workCenter.hasWorkAtHeight',
    'HIGH_RISK_WORK',
    'WORK_CENTER',
    'BOOLEAN',
    '¿En este centro se realizan trabajos en altura?',
    { priority: 50 },
  ),
  fact(
    'workCenter.hasConfinedSpaces',
    'HIGH_RISK_WORK',
    'WORK_CENTER',
    'BOOLEAN',
    '¿Se ingresa a espacios confinados?',
    { priority: 51 },
  ),
  fact(
    'workCenter.hasExternalWorkforce',
    'CONTRACTORS',
    'WORK_CENTER',
    'BOOLEAN',
    '¿Trabajan contratistas o personal de otras empresas?',
    { priority: 52 },
  ),
  fact(
    'workCenter.hasCriticalMachinery',
    'OPERATION',
    'WORK_CENTER',
    'BOOLEAN',
    '¿Se utiliza maquinaria crítica en este centro?',
    { priority: 53 },
  ),
];

const target = (
  targetKey: string,
  title: string,
  description: string,
  category: AdaptiveTargetVersionContract['category'],
  evidenceSuggestions: AdaptiveTargetVersionContract['evidenceSuggestions'],
): AdaptiveTargetVersionContract => ({
  targetKey,
  version: '1.0.0',
  title,
  description,
  category,
  currentStateQuestion: `¿Cuál es el estado actual de “${title}”?`,
  evidenceSuggestions,
  isDemo: true,
});

export const DEMO_ADAPTIVE_TARGET_VERSIONS: AdaptiveTargetVersionContract[] = [
  target(
    'SST_MANAGEMENT_BASELINE',
    'Gestión SST mínima',
    'Base organizativa para ordenar la gestión preventiva.',
    'GOVERNANCE',
    ['DOCUMENT', 'RECORD'],
  ),
  target(
    'EMERGENCY_PREPAREDNESS',
    'Preparación ante emergencias',
    'Revisión visible de respuesta y condiciones del centro.',
    'EMERGENCY_PREPAREDNESS',
    ['DOCUMENT', 'TRAINING', 'INSPECTION'],
  ),
  target(
    'REMOTE_WORK_REVIEW',
    'Revisión de bienestar en trabajo remoto',
    'Revisión general DEMO del contexto de trabajo remoto o híbrido.',
    'HEALTH_MANAGEMENT',
    ['RECORD', 'TRAINING'],
  ),
  target(
    'CHEMICAL_PROCESS_CONTROLS',
    'Controles para procesos químicos',
    'Revisión técnica DEMO de procesos y controles químicos.',
    'HIGH_RISK_WORK',
    ['DOCUMENT', 'MEASUREMENT', 'FIELD_OBSERVATION'],
  ),
  target(
    'HIGH_ENERGY_PROFESSIONAL_REVIEW',
    'Revisión profesional de alta energía',
    'Análisis profesional DEMO para operaciones de alta energía.',
    'PROFESSIONAL_REVIEW',
    ['INSPECTION', 'CERTIFICATE', 'MEASUREMENT'],
  ),
  target(
    'MULTI_CENTER_COORDINATION',
    'Coordinación entre centros',
    'Coordinación DEMO de responsabilidades y seguimiento entre centros.',
    'GOVERNANCE',
    ['DOCUMENT', 'RECORD'],
  ),
  target(
    'HIGH_RISK_WORK_CONTROLS',
    'Controles para trabajo de mayor riesgo',
    'Revisión técnica DEMO de altura, espacios confinados y maquinaria.',
    'HIGH_RISK_WORK',
    ['TRAINING', 'CERTIFICATE', 'FIELD_OBSERVATION'],
  ),
  target(
    'EXTERNAL_WORKFORCE_COORDINATION',
    'Coordinación con personal externo',
    'Coordinación DEMO con contratistas y otras empresas.',
    'CONTRACTOR_COORDINATION',
    ['CONTRACT', 'RECORD', 'TRAINING'],
  ),
  target(
    'TECHNICAL_INSPECTION_PLANNING',
    'Planificación de inspecciones técnicas',
    'Plan DEMO de inspecciones según actividad e infraestructura.',
    'INSPECTION',
    ['INSPECTION', 'PHOTO', 'RECORD'],
  ),
];

const p = (
  factKey: string,
  operator: AdaptivePredicate['operator'],
  value?: AdaptivePredicate['value'],
  factScope: AdaptivePredicate['factScope'] = 'CURRENT_SCOPE',
): AdaptivePredicate => ({
  kind: 'PREDICATE',
  factKey,
  factScope,
  operator,
  ...(value === undefined ? {} : { value }),
});
const all = (...clauses: AdaptiveExpression[]): AdaptiveExpression => ({
  kind: 'GROUP',
  mode: 'ALL',
  clauses,
});
const anyOf = (...clauses: AdaptiveExpression[]): AdaptiveExpression => ({
  kind: 'GROUP',
  mode: 'ANY',
  clauses,
});
const rule = (
  ruleKey: string,
  groupKey: string,
  scopeMode: 'ORGANIZATION' | 'EACH_WORK_CENTER',
  condition: AdaptiveExpression,
  targetKey: string,
  state: AdaptiveState,
  minimumDepth: AdaptiveDepth,
  explanation: string,
  professionalReview = false,
): AdaptiveRuleVersionContract => ({
  ruleKey,
  version: '1.0.0',
  groupKey,
  scopeMode,
  condition,
  targetKey,
  state,
  minimumDepth,
  professionalReview,
  reasonCode: `${ruleKey}_DEMO`,
  explanation,
  isDemo: true,
  regulatory: false,
});

export const DEMO_ADAPTIVE_RULES: AdaptiveRuleVersionContract[] = [
  rule(
    'GENERAL_MANAGEMENT_BASELINE',
    'GENERAL',
    'ORGANIZATION',
    p('organization.country', 'EXISTS', undefined, 'ORGANIZATION'),
    'SST_MANAGEMENT_BASELINE',
    'RECOMMENDED',
    'BASIC_VISIBLE',
    'La propuesta DEMO incluye una base mínima de gestión.',
  ),
  rule(
    'PHYSICAL_EMERGENCY_REVIEW',
    'PHYSICAL_WORKPLACE',
    'EACH_WORK_CENTER',
    p('workCenter.facilityType', 'EXISTS'),
    'EMERGENCY_PREPAREDNESS',
    'RECOMMENDED',
    'BASIC_VISIBLE',
    'El tipo de instalación permite orientar una revisión visible de emergencias.',
  ),
  rule(
    'PHYSICAL_TECHNICAL_INSPECTION',
    'PHYSICAL_WORKPLACE',
    'EACH_WORK_CENTER',
    p('workCenter.hasDistinctOperationalZones', 'BOOLEAN_IS', true),
    'TECHNICAL_INSPECTION_PLANNING',
    'RECOMMENDED',
    'TECHNICAL',
    'Zonas operativas distintas justifican una revisión técnica DEMO.',
  ),
  rule(
    'REMOTE_WELLBEING_REVIEW',
    'REMOTE_HYBRID',
    'EACH_WORK_CENTER',
    p('workCenter.workArrangement', 'IN', ['REMOTE', 'HYBRID']),
    'REMOTE_WORK_REVIEW',
    'RECOMMENDED',
    'BASIC_VISIBLE',
    'El trabajo remoto o híbrido activa una revisión general DEMO.',
  ),
  rule(
    'MULTI_CENTER_COORDINATION_RULE',
    'MULTI_CENTER',
    'ORGANIZATION',
    p('organization.workCenterCount', 'NUMBER_GTE', 2, 'ORGANIZATION'),
    'MULTI_CENTER_COORDINATION',
    'RECOMMENDED',
    'TECHNICAL',
    'Varios centros requieren coordinación DEMO entre alcances.',
  ),
  rule(
    'CHEMICAL_PROCESS_RULE',
    'CHEMICAL_PROCESS',
    'EACH_WORK_CENTER',
    p('workCenter.hasChemicalProcesses', 'BOOLEAN_IS', true),
    'CHEMICAL_PROCESS_CONTROLS',
    'RECOMMENDED',
    'TECHNICAL',
    'Un proceso químico declarado activa controles técnicos DEMO.',
  ),
  rule(
    'HIGH_ENERGY_RULE',
    'HIGH_ENERGY',
    'EACH_WORK_CENTER',
    p('workCenter.hasHighEnergyOperations', 'BOOLEAN_IS', true),
    'HIGH_ENERGY_PROFESSIONAL_REVIEW',
    'NEEDS_EXPERT_REVIEW',
    'TECHNICAL',
    'Una operación de alta energía declarada necesita criterio profesional.',
    true,
  ),
  rule(
    'CONSTRUCTION_HEIGHT_RULE',
    'CONSTRUCTION_HIGH_RISK',
    'EACH_WORK_CENTER',
    p('workCenter.hasWorkAtHeight', 'BOOLEAN_IS', true),
    'HIGH_RISK_WORK_CONTROLS',
    'RECOMMENDED',
    'TECHNICAL',
    'El trabajo en altura declarado activa una revisión técnica DEMO.',
  ),
  rule(
    'CONSTRUCTION_CONFINED_RULE',
    'CONSTRUCTION_HIGH_RISK',
    'EACH_WORK_CENTER',
    p('workCenter.hasConfinedSpaces', 'BOOLEAN_IS', true),
    'HIGH_RISK_WORK_CONTROLS',
    'NEEDS_EXPERT_REVIEW',
    'TECHNICAL',
    'El ingreso a espacios confinados necesita criterio profesional DEMO.',
    true,
  ),
  rule(
    'CONSTRUCTION_MACHINERY_RULE',
    'CONSTRUCTION_HIGH_RISK',
    'EACH_WORK_CENTER',
    p('workCenter.hasCriticalMachinery', 'BOOLEAN_IS', true),
    'TECHNICAL_INSPECTION_PLANNING',
    'RECOMMENDED',
    'TECHNICAL',
    'La maquinaria crítica declarada activa inspección técnica DEMO.',
  ),
  rule(
    'EXTERNAL_WORKFORCE_RULE',
    'EXTERNAL_WORKFORCE',
    'EACH_WORK_CENTER',
    p('workCenter.hasExternalWorkforce', 'BOOLEAN_IS', true),
    'EXTERNAL_WORKFORCE_COORDINATION',
    'RECOMMENDED',
    'TECHNICAL',
    'La presencia declarada de personal externo activa coordinación DEMO.',
  ),
  rule(
    'AMBIGUOUS_ACTIVITY_CLARIFICATION',
    'PHYSICAL_WORKPLACE',
    'EACH_WORK_CENTER',
    all(
      p('workCenter.activityCategory', 'EQUALS', 'OTHER_AMBIGUOUS'),
      p('workCenter.activityDescription', 'EXISTS'),
    ),
    'TECHNICAL_INSPECTION_PLANNING',
    'NEEDS_EXPERT_REVIEW',
    'UNDETERMINED',
    'Una actividad ambigua requiere aclaración antes de proponer profundidad.',
    true,
  ),
];

const group = (
  groupKey: string,
  title: string,
  priority: number,
  scopeMode: 'ORGANIZATION' | 'EACH_WORK_CENTER',
  activation: AdaptiveExpression,
  ruleKeys: string[],
): AdaptiveRuleGroupVersionContract => ({
  groupKey,
  version: '1.0.0',
  title,
  priority,
  scopeMode,
  activation,
  ruleKeys,
  isDemo: true,
  regulatory: false,
});

export const DEMO_ADAPTIVE_GROUPS: AdaptiveRuleGroupVersionContract[] = [
  group(
    'GENERAL',
    'Base general',
    10,
    'ORGANIZATION',
    p('organization.country', 'EXISTS', undefined, 'ORGANIZATION'),
    ['GENERAL_MANAGEMENT_BASELINE'],
  ),
  group(
    'PHYSICAL_WORKPLACE',
    'Centro de trabajo físico',
    20,
    'EACH_WORK_CENTER',
    p('workCenter.workArrangement', 'IN', ['PHYSICAL', 'HYBRID']),
    [
      'AMBIGUOUS_ACTIVITY_CLARIFICATION',
      'PHYSICAL_EMERGENCY_REVIEW',
      'PHYSICAL_TECHNICAL_INSPECTION',
    ],
  ),
  group(
    'REMOTE_HYBRID',
    'Trabajo remoto o híbrido',
    30,
    'EACH_WORK_CENTER',
    p('workCenter.workArrangement', 'IN', ['REMOTE', 'HYBRID']),
    ['REMOTE_WELLBEING_REVIEW'],
  ),
  group(
    'MULTI_CENTER',
    'Coordinación multicentro',
    40,
    'ORGANIZATION',
    p('organization.workCenterCount', 'NUMBER_GTE', 2, 'ORGANIZATION'),
    ['MULTI_CENTER_COORDINATION_RULE'],
  ),
  group(
    'CHEMICAL_PROCESS',
    'Procesos químicos',
    50,
    'EACH_WORK_CENTER',
    p('workCenter.hasChemicalProcesses', 'BOOLEAN_IS', true),
    ['CHEMICAL_PROCESS_RULE'],
  ),
  group(
    'HIGH_ENERGY',
    'Operaciones de alta energía',
    60,
    'EACH_WORK_CENTER',
    p('workCenter.hasHighEnergyOperations', 'BOOLEAN_IS', true),
    ['HIGH_ENERGY_RULE'],
  ),
  group(
    'CONSTRUCTION_HIGH_RISK',
    'Construcción y trabajo de mayor riesgo',
    70,
    'EACH_WORK_CENTER',
    anyOf(
      p('workCenter.activityCategory', 'EQUALS', 'CONSTRUCTION_ASSEMBLY'),
      p('workCenter.hasWorkAtHeight', 'BOOLEAN_IS', true),
      p('workCenter.hasConfinedSpaces', 'BOOLEAN_IS', true),
    ),
    ['CONSTRUCTION_CONFINED_RULE', 'CONSTRUCTION_HEIGHT_RULE', 'CONSTRUCTION_MACHINERY_RULE'],
  ),
  group(
    'EXTERNAL_WORKFORCE',
    'Personal externo',
    80,
    'EACH_WORK_CENTER',
    p('workCenter.hasExternalWorkforce', 'BOOLEAN_IS', true),
    ['EXTERNAL_WORKFORCE_RULE'],
  ),
];

export const DEMO_ADAPTIVE_RULE_PACK: AdaptiveRulePackContract = validateAdaptivePack({
  packKey: 'DEMO_ADAPTIVE_SST_CONFIGURATION',
  version: '1.0.0',
  engineSchemaVersion: ADAPTIVE_ENGINE_VERSION,
  name: 'Configuración SST adaptativa DEMO',
  isDemo: true,
  regulatory: false,
  disclaimer: ADAPTIVE_DEMO_DISCLAIMER,
  factVersions: DEMO_ADAPTIVE_FACT_VERSIONS,
  targetVersions: DEMO_ADAPTIVE_TARGET_VERSIONS,
  groups: DEMO_ADAPTIVE_GROUPS,
  rules: DEMO_ADAPTIVE_RULES,
});

export function assertAdaptiveRulePublication(input: {
  isDemo: boolean;
  regulatory: boolean;
  disclaimer?: string;
  requirementStatuses: string[];
}) {
  if (input.regulatory) {
    if (input.isDemo) throw new Error('Regulatory rule cannot be DEMO');
    if (input.requirementStatuses.length === 0)
      throw new Error('Regulatory rule requires provenance');
    if (input.requirementStatuses.some((status) => status !== 'APPROVED_FOR_RULE_DRAFTING'))
      throw new Error('Regulatory rule requires approved requirements');
    return;
  }
  if (!input.isDemo || !input.disclaimer?.trim())
    throw new Error('Unlinked non-regulatory rules require DEMO disclaimer');
}
