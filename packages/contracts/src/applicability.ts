import { z } from 'zod';

export const APPLICABILITY_STATES = [
  'MANDATORY',
  'RECOMMENDED',
  'OPTIONAL',
  'NOT_APPLICABLE',
  'NEEDS_INFORMATION',
  'NEEDS_EXPERT_REVIEW',
] as const;

export const applicabilityStateSchema = z.enum(APPLICABILITY_STATES);
export type ApplicabilityState = z.infer<typeof applicabilityStateSchema>;

export const APPLICABILITY_SOURCE_TYPES = ['DEMO', 'REGULATORY', 'STANDARD', 'INTERNAL'] as const;

export const applicabilitySourceTypeSchema = z.enum(APPLICABILITY_SOURCE_TYPES);
export type ApplicabilitySourceType = z.infer<typeof applicabilitySourceTypeSchema>;

export const organizationSstProfileV1Schema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    organization: z
      .object({
        country: z.string().trim().min(1).max(120),
        sector: z.string().trim().min(1).max(160).optional(),
        workCenterCount: z.number().int().min(0).max(100_000),
        workerCount: z.number().int().min(1).max(10_000_000).optional(),
      })
      .strict(),
    operations: z
      .object({
        hasChemicalProcesses: z.boolean().optional(),
        hasHighEnergyOperations: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();

export const organizationProfileFactKeys = [
  'ECONOMIC_ACTIVITY_CONFIRMED',
  'PHYSICAL_SITE_PRESENT',
  'ADMINISTRATIVE_OR_REMOTE_ONLY',
  'CONTRACTOR_OR_EXTERNAL_PERSONNEL_PRESENT',
  'CHEMICAL_PROCESS_PRESENT',
  'HIGH_ENERGY_OPERATION_PRESENT',
  'WORK_CENTER_CITY_CONFIRMED',
  'WORK_AREAS_PRESENT',
  'POSITIONS_PRESENT',
  'PROCESS_ACTIVITY_FAMILIES_CONFIRMED',
  'EQUIPMENT_RESOURCE_FAMILIES_CONFIRMED',
] as const;

export const organizationProfileEvidenceTypes = [
  'SAFETY_OBSERVATION_EVIDENCE',
  'INCIDENT_EVIDENCE',
  'ACTION_EVIDENCE',
  'OBLIGATION_EXECUTION_EVIDENCE',
  'TECHNICAL_ASSESSMENT_EVIDENCE',
  'GOVERNANCE_EVIDENCE',
] as const;

export const organizationProfileEvidenceReferenceInputSchema = z
  .object({
    type: z.enum(organizationProfileEvidenceTypes),
    id: z.uuid(),
  })
  .strict();

export const organizationProfileEvidenceReferenceSchema =
  organizationProfileEvidenceReferenceInputSchema.extend({
    label: z.string().trim().min(1).max(240),
  });

export const organizationProfileFactProvenanceSources = [
  'DECLARED_BY_ORGANIZATION',
  'DERIVED_DETERMINISTICALLY',
  'EVIDENCE_BACKED',
  'IMPORTED_REFERENCE',
  'PROFESSIONAL_CONFIRMED',
] as const;

const organizationProfileFactBaseSchema = z
  .object({
    key: z.enum(organizationProfileFactKeys),
    value: z.enum(['KNOWN_TRUE', 'KNOWN_FALSE', 'UNKNOWN']),
    scope: z.enum(['ORGANIZATION', 'WORK_CENTER']),
    workCenterId: z.uuid().optional(),
    provenance: z
      .object({
        source: z.enum(organizationProfileFactProvenanceSources),
        evidenceReference: organizationProfileEvidenceReferenceSchema.optional(),
        actorUserId: z.uuid().optional(),
        confirmedAt: z.iso.datetime().optional(),
        note: z.string().trim().min(1).max(500).optional(),
      })
      .strict(),
  })
  .strict();

export const organizationProfileFactSchema = organizationProfileFactBaseSchema.superRefine(
  (fact, context) => {
    if (fact.scope === 'WORK_CENTER' && !fact.workCenterId) {
      context.addIssue({
        code: 'custom',
        path: ['workCenterId'],
        message: 'Work center scope requires an id',
      });
    }
    if (fact.scope === 'ORGANIZATION' && fact.workCenterId) {
      context.addIssue({
        code: 'custom',
        path: ['workCenterId'],
        message: 'Organization facts cannot reference a work center',
      });
    }
    if (fact.provenance.source === 'EVIDENCE_BACKED' && !fact.provenance.evidenceReference) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'evidenceReference'],
        message: 'Evidence-backed facts require a reference',
      });
    }
    if (fact.provenance.source !== 'EVIDENCE_BACKED' && fact.provenance.evidenceReference) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'evidenceReference'],
        message: 'Evidence references are exclusive to evidence-backed facts',
      });
    }
    if (
      fact.provenance.source === 'PROFESSIONAL_CONFIRMED' &&
      (!fact.provenance.actorUserId || !fact.provenance.confirmedAt)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['provenance'],
        message: 'Professional confirmation requires server-owned actor and timestamp',
      });
    }
    if (
      fact.provenance.source !== 'PROFESSIONAL_CONFIRMED' &&
      (fact.provenance.actorUserId || fact.provenance.confirmedAt)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['provenance'],
        message: 'Professional confirmation metadata is exclusive to professional facts',
      });
    }
  },
);

export type OrganizationProfileFact = z.infer<typeof organizationProfileFactSchema>;

export const organizationProfileFactInputSchema = organizationProfileFactBaseSchema
  .extend({
    provenance: organizationProfileFactBaseSchema.shape.provenance.extend({
      evidenceReference: organizationProfileEvidenceReferenceInputSchema.optional(),
      actorUserId: z.never().optional(),
      confirmedAt: z.never().optional(),
    }),
  })
  .superRefine((fact, context) => {
    if (fact.scope === 'WORK_CENTER' && !fact.workCenterId) {
      context.addIssue({
        code: 'custom',
        path: ['workCenterId'],
        message: 'Work center scope requires an id',
      });
    }
    if (fact.scope === 'ORGANIZATION' && fact.workCenterId) {
      context.addIssue({
        code: 'custom',
        path: ['workCenterId'],
        message: 'Organization facts cannot reference a work center',
      });
    }
    if (fact.provenance.source === 'EVIDENCE_BACKED' && !fact.provenance.evidenceReference) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'evidenceReference'],
        message: 'Evidence-backed facts require a reference',
      });
    }
    if (fact.provenance.source !== 'EVIDENCE_BACKED' && fact.provenance.evidenceReference) {
      context.addIssue({
        code: 'custom',
        path: ['provenance', 'evidenceReference'],
        message: 'Evidence references are exclusive to evidence-backed facts',
      });
    }
  });

export type OrganizationProfileFactInput = z.infer<typeof organizationProfileFactInputSchema>;

export const organizationSstProfileV2Schema = z
  .object({
    schemaVersion: z.literal('2.0.0'),
    organization: organizationSstProfileV1Schema.shape.organization
      .extend({
        managementPriority: z.enum(['ROUTINE', 'FOCUSED', 'URGENT']).optional(),
      })
      .strict(),
    operations: organizationSstProfileV1Schema.shape.operations,
    contextFacts: z.array(organizationProfileFactSchema).max(250),
  })
  .strict()
  .superRefine((profile, context) => {
    const keys = profile.contextFacts.map(
      (fact) => `${fact.scope}:${fact.workCenterId ?? ''}:${fact.key}`,
    );
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: 'custom',
        path: ['contextFacts'],
        message: 'Scoped fact keys must be unique',
      });
    }
  });

export const organizationSstProfileSchema = z.union([
  organizationSstProfileV1Schema,
  organizationSstProfileV2Schema,
]);

export type OrganizationSstProfile = z.infer<typeof organizationSstProfileSchema>;

const stringFieldSchema = z.enum(['organization.country', 'organization.sector']);
const numberFieldSchema = z.enum(['organization.workCenterCount', 'organization.workerCount']);
const booleanFieldSchema = z.enum([
  'operations.hasChemicalProcesses',
  'operations.hasHighEnergyOperations',
]);

const stringPredicateSchema = z.union([
  z
    .object({
      field: stringFieldSchema,
      operator: z.literal('EQUALS'),
      value: z.string().max(160),
    })
    .strict(),
  z
    .object({
      field: stringFieldSchema,
      operator: z.literal('IN'),
      values: z.array(z.string().max(160)).min(1).max(20),
    })
    .strict(),
]);

const numberPredicateSchema = z.union([
  z
    .object({
      field: numberFieldSchema,
      operator: z.literal('EQUALS'),
      value: z.number().finite(),
    })
    .strict(),
  z
    .object({
      field: numberFieldSchema,
      operator: z.literal('IN'),
      values: z.array(z.number().finite()).min(1).max(20),
    })
    .strict(),
  z
    .object({
      field: numberFieldSchema,
      operator: z.literal('NUMBER_GTE'),
      value: z.number().finite(),
    })
    .strict(),
  z
    .object({
      field: numberFieldSchema,
      operator: z.literal('NUMBER_LTE'),
      value: z.number().finite(),
    })
    .strict(),
]);

const booleanPredicateSchema = z
  .object({
    field: booleanFieldSchema,
    operator: z.literal('BOOLEAN_IS'),
    value: z.boolean(),
  })
  .strict();

export const applicabilityPredicateSchema = z.union([
  stringPredicateSchema,
  numberPredicateSchema,
  booleanPredicateSchema,
]);

export type ApplicabilityPredicate = z.infer<typeof applicabilityPredicateSchema>;

export const applicabilityRuleSchema = z
  .object({
    id: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
    targetKey: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
    condition: z
      .object({
        mode: z.enum(['ALL', 'ANY']),
        predicates: z.array(applicabilityPredicateSchema).min(1).max(12),
      })
      .strict(),
    state: applicabilityStateSchema,
    reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
    explanation: z.string().min(1).max(500),
    sourceReference: z.string().min(1).max(500).optional(),
  })
  .strict();

export const applicabilityRulePackSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    key: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
    name: z.string().min(1).max(160),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    source: z
      .object({
        type: applicabilitySourceTypeSchema,
        reference: z.string().min(1).max(500).optional(),
      })
      .strict(),
    regulatory: z.boolean(),
    isDemo: z.boolean(),
    disclaimer: z.string().min(1).max(500),
    rules: z.array(applicabilityRuleSchema).min(1).max(100),
  })
  .strict()
  .superRefine((pack, context) => {
    const ids = pack.rules.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', path: ['rules'], message: 'Rule ids must be unique' });
    }
    if (pack.source.type === 'DEMO' && (!pack.isDemo || pack.regulatory)) {
      context.addIssue({
        code: 'custom',
        path: ['source'],
        message: 'Demo packs must be non-regulatory demo content',
      });
    }
  });

export type ApplicabilityRulePack = z.infer<typeof applicabilityRulePackSchema>;
export type PredicateResult = 'TRUE' | 'FALSE' | 'MISSING';
export type RuleResult = PredicateResult;

export type ApplicabilityPredicateTrace = {
  predicateIndex: number;
  field: ApplicabilityPredicate['field'];
  operator: ApplicabilityPredicate['operator'];
  expected: string | number | boolean | readonly (string | number)[];
  actual: string | number | boolean | null;
  result: PredicateResult;
};

export type ApplicabilityRuleTrace = {
  ruleId: string;
  targetKey: string;
  mode: 'ALL' | 'ANY';
  result: RuleResult;
  configuredState: ApplicabilityState;
  contributedState: ApplicabilityState | null;
  reasonCode: string;
  explanation: string;
  predicates: ApplicabilityPredicateTrace[];
};

export type ApplicabilityDecisionResult = {
  targetKey: string;
  state: ApplicabilityState;
  reasonCode: string;
  explanation: string;
  sourceType: ApplicabilitySourceType;
  sourceReference: string | null;
  winningRuleId: string | null;
  trace: ApplicabilityRuleTrace[];
};

export type ApplicabilityEvaluationResult = {
  engineVersion: '1.0.0';
  decisions: ApplicabilityDecisionResult[];
};

const STATE_PRECEDENCE: Readonly<Record<ApplicabilityState, number>> = {
  NEEDS_EXPERT_REVIEW: 60,
  MANDATORY: 50,
  NEEDS_INFORMATION: 40,
  RECOMMENDED: 30,
  OPTIONAL: 20,
  NOT_APPLICABLE: 10,
};

function profileValue(profile: OrganizationSstProfile, field: ApplicabilityPredicate['field']) {
  switch (field) {
    case 'organization.country':
      return profile.organization.country;
    case 'organization.sector':
      return profile.organization.sector;
    case 'organization.workCenterCount':
      return profile.organization.workCenterCount;
    case 'organization.workerCount':
      return profile.organization.workerCount;
    case 'operations.hasChemicalProcesses':
      return profile.operations.hasChemicalProcesses;
    case 'operations.hasHighEnergyOperations':
      return profile.operations.hasHighEnergyOperations;
  }
}

function predicateExpected(predicate: ApplicabilityPredicate) {
  return 'values' in predicate ? predicate.values : predicate.value;
}

function evaluatePredicate(
  profile: OrganizationSstProfile,
  predicate: ApplicabilityPredicate,
  predicateIndex: number,
): ApplicabilityPredicateTrace {
  const actual = profileValue(profile, predicate.field);
  if (actual === undefined) {
    return {
      predicateIndex,
      field: predicate.field,
      operator: predicate.operator,
      expected: predicateExpected(predicate),
      actual: null,
      result: 'MISSING',
    };
  }

  let matches: boolean;
  switch (predicate.operator) {
    case 'EQUALS':
      matches = actual === predicate.value;
      break;
    case 'IN':
      matches = (predicate.values as readonly unknown[]).includes(actual);
      break;
    case 'NUMBER_GTE':
      matches = typeof actual === 'number' && actual >= predicate.value;
      break;
    case 'NUMBER_LTE':
      matches = typeof actual === 'number' && actual <= predicate.value;
      break;
    case 'BOOLEAN_IS':
      matches = actual === predicate.value;
      break;
  }
  return {
    predicateIndex,
    field: predicate.field,
    operator: predicate.operator,
    expected: predicateExpected(predicate),
    actual,
    result: matches ? 'TRUE' : 'FALSE',
  };
}

function combine(mode: 'ALL' | 'ANY', predicates: readonly ApplicabilityPredicateTrace[]) {
  if (mode === 'ALL') {
    if (predicates.some(({ result }) => result === 'FALSE')) return 'FALSE' as const;
    if (predicates.some(({ result }) => result === 'MISSING')) return 'MISSING' as const;
    return 'TRUE' as const;
  }
  if (predicates.some(({ result }) => result === 'TRUE')) return 'TRUE' as const;
  if (predicates.some(({ result }) => result === 'MISSING')) return 'MISSING' as const;
  return 'FALSE' as const;
}

function traceRule(profile: OrganizationSstProfile, rule: z.infer<typeof applicabilityRuleSchema>) {
  const predicates = rule.condition.predicates.map((predicate, index) =>
    evaluatePredicate(profile, predicate, index),
  );
  const result = combine(rule.condition.mode, predicates);
  const missingFields = predicates
    .filter(({ result: predicateResult }) => predicateResult === 'MISSING')
    .map(({ field }) => field)
    .sort();
  return {
    ruleId: rule.id,
    targetKey: rule.targetKey,
    mode: rule.condition.mode,
    result,
    configuredState: rule.state,
    contributedState:
      result === 'TRUE' ? rule.state : result === 'MISSING' ? 'NEEDS_INFORMATION' : null,
    reasonCode: result === 'MISSING' ? 'MISSING_PROFILE_INFORMATION' : rule.reasonCode,
    explanation:
      result === 'MISSING'
        ? `Falta información del perfil: ${missingFields.join(', ')}.`
        : rule.explanation,
    predicates,
  } satisfies ApplicabilityRuleTrace;
}

export function evaluateApplicability(
  profileInput: unknown,
  rulePackInput: unknown,
): ApplicabilityEvaluationResult {
  const profile = organizationSstProfileSchema.parse(profileInput);
  const pack = applicabilityRulePackSchema.parse(rulePackInput);
  const targetKeys = [...new Set(pack.rules.map(({ targetKey }) => targetKey))].sort();

  return {
    engineVersion: '1.0.0',
    decisions: targetKeys.map((targetKey) => {
      const trace = pack.rules
        .filter((rule) => rule.targetKey === targetKey)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((rule) => traceRule(profile, rule));
      const winner = trace
        .filter(
          (
            candidate,
          ): candidate is ApplicabilityRuleTrace & {
            contributedState: ApplicabilityState;
          } => candidate.contributedState !== null,
        )
        .sort((left, right) => {
          const precedence =
            STATE_PRECEDENCE[right.contributedState] - STATE_PRECEDENCE[left.contributedState];
          return precedence || left.ruleId.localeCompare(right.ruleId);
        })[0];

      return {
        targetKey,
        state: winner?.contributedState ?? 'NOT_APPLICABLE',
        reasonCode: winner?.reasonCode ?? 'NO_APPLICABLE_RULE',
        explanation:
          winner?.explanation ?? 'Ninguna regla configurada resultó aplicable para este perfil.',
        sourceType: pack.source.type,
        sourceReference:
          pack.rules.find(({ id }) => id === winner?.ruleId)?.sourceReference ??
          pack.source.reference ??
          null,
        winningRuleId: winner?.ruleId ?? null,
        trace,
      };
    }),
  };
}

export const DEMO_APPLICABILITY_RULE_PACK: ApplicabilityRulePack = {
  schemaVersion: '1.0.0',
  key: 'DEMO_APPLICABILITY',
  name: 'Configuración SST demostrativa',
  version: '1.0.0',
  source: { type: 'DEMO', reference: 'Contenido sintético SST Intelligence Platform' },
  regulatory: false,
  isDemo: true,
  disclaimer:
    'Reglas sintéticas de demostración. No representan normativa ni acreditan cumplimiento legal.',
  rules: [
    {
      id: 'DEMO_BASELINE_MANDATORY',
      targetKey: 'DEMO_BASELINE_MANAGEMENT',
      condition: {
        mode: 'ALL',
        predicates: [{ field: 'organization.workCenterCount', operator: 'NUMBER_GTE', value: 1 }],
      },
      state: 'MANDATORY',
      reasonCode: 'DEMO_BASELINE_PRESENT',
      explanation: 'La demostración incluye una configuración base cuando existe un centro.',
    },
    {
      id: 'DEMO_MULTI_SITE_RECOMMENDED',
      targetKey: 'DEMO_MULTI_SITE_COORDINATION',
      condition: {
        mode: 'ALL',
        predicates: [{ field: 'organization.workCenterCount', operator: 'NUMBER_GTE', value: 2 }],
      },
      state: 'RECOMMENDED',
      reasonCode: 'DEMO_MULTIPLE_WORK_CENTERS',
      explanation: 'La demostración recomienda coordinación cuando hay varios centros.',
    },
    {
      id: 'DEMO_SECTOR_OPTIONAL',
      targetKey: 'DEMO_SECTOR_GUIDANCE',
      condition: {
        mode: 'ANY',
        predicates: [
          { field: 'organization.sector', operator: 'IN', values: ['Servicios', 'Tecnología'] },
        ],
      },
      state: 'OPTIONAL',
      reasonCode: 'DEMO_SECTOR_MATCH',
      explanation: 'La demostración ofrece una guía opcional para sectores de ejemplo.',
    },
    {
      id: 'DEMO_CHEMICAL_MANDATORY',
      targetKey: 'DEMO_CHEMICAL_CONTROL',
      condition: {
        mode: 'ALL',
        predicates: [
          { field: 'operations.hasChemicalProcesses', operator: 'BOOLEAN_IS', value: true },
        ],
      },
      state: 'MANDATORY',
      reasonCode: 'DEMO_CHEMICAL_PROCESS_PRESENT',
      explanation: 'La regla sintética activa el control demostrativo para este escenario.',
    },
    {
      id: 'DEMO_CHEMICAL_NOT_APPLICABLE',
      targetKey: 'DEMO_CHEMICAL_CONTROL',
      condition: {
        mode: 'ALL',
        predicates: [
          { field: 'operations.hasChemicalProcesses', operator: 'BOOLEAN_IS', value: false },
        ],
      },
      state: 'NOT_APPLICABLE',
      reasonCode: 'DEMO_NO_CHEMICAL_PROCESS',
      explanation: 'La regla sintética no aplica el control cuando el proceso no está presente.',
    },
    {
      id: 'DEMO_HIGH_ENERGY_EXPERT',
      targetKey: 'DEMO_HIGH_ENERGY_REVIEW',
      condition: {
        mode: 'ALL',
        predicates: [
          { field: 'operations.hasHighEnergyOperations', operator: 'BOOLEAN_IS', value: true },
        ],
      },
      state: 'NEEDS_EXPERT_REVIEW',
      reasonCode: 'DEMO_HIGH_ENERGY_SCENARIO',
      explanation: 'El escenario sintético requiere revisión profesional antes de una conclusión.',
    },
    {
      id: 'DEMO_HIGH_ENERGY_NOT_APPLICABLE',
      targetKey: 'DEMO_HIGH_ENERGY_REVIEW',
      condition: {
        mode: 'ALL',
        predicates: [
          { field: 'operations.hasHighEnergyOperations', operator: 'BOOLEAN_IS', value: false },
        ],
      },
      state: 'NOT_APPLICABLE',
      reasonCode: 'DEMO_NO_HIGH_ENERGY_OPERATION',
      explanation:
        'El escenario sintético no solicita revisión cuando la operación no está presente.',
    },
    {
      id: 'DEMO_WORKFORCE_RECOMMENDED',
      targetKey: 'DEMO_WORKFORCE_GUIDANCE',
      condition: {
        mode: 'ALL',
        predicates: [{ field: 'organization.workerCount', operator: 'NUMBER_GTE', value: 20 }],
      },
      state: 'RECOMMENDED',
      reasonCode: 'DEMO_WORKFORCE_THRESHOLD',
      explanation: 'La demostración recomienda una guía al alcanzar su umbral puramente sintético.',
    },
  ],
};
