import { applicabilityStateSchema, organizationSstProfileSchema } from '@sst/contracts';
import { z } from 'zod';

export const SCENARIO_SCHEMA_VERSION = '1.0.0' as const;

export const scenarioKindSchema = z.enum(['SYNTHETIC', 'PSEUDONYMIZED_EXPERT_CASE']);
export type ScenarioKind = z.infer<typeof scenarioKindSchema>;

export const strategicProtectionPrioritySchema = z.enum([
  'PEOPLE_AND_HEALTH',
  'PRODUCTIVE_CONTINUITY',
  'BUSINESS_CONTINUITY',
  'MACHINERY_AND_INFRASTRUCTURE',
  'FINANCIAL_IMPACT',
  'REPUTATION',
  'CONTRACTORS_AND_SUPPLY_CHAIN',
  'PRODUCT_OR_SERVICE_QUALITY',
]);

export const implementationHypothesisSchema = z.enum([
  'UNKNOWN',
  'NOT_IMPLEMENTED',
  'PLANNED',
  'IN_PROGRESS',
  'PARTIALLY_IMPLEMENTED',
  'IMPLEMENTED',
]);

export const evidenceHypothesisSchema = z.enum([
  'NO_EVIDENCE',
  'SELF_DECLARED',
  'NOTE_AVAILABLE',
  'EXTERNAL_LINK_AVAILABLE',
]);

export const depthLevelSchema = z.enum([
  'LEVEL_1_VISIBLE_OPERATIONAL',
  'LEVEL_2_TECHNICAL_SOURCE_BASED',
  'LEVEL_3_SYSTEMIC_CHANGE_MANAGEMENT',
]);

export const expertValidationStatusSchema = z.enum([
  'PENDING_EXPERT_REVIEW',
  'AGREES',
  'PARTIALLY_AGREES',
  'DISAGREES',
  'NEEDS_MORE_INFORMATION',
]);

export const futureContextKeySchema = z.enum([
  'WORKER_COUNT_BY_CENTER',
  'ECONOMIC_ACTIVITIES_BY_CENTER',
  'RISK_CLASSIFICATION_BY_CENTER',
  'FACILITY_TYPE',
  'MULTIPLE_ECONOMIC_ACTIVITIES',
  'TRANSPORT_OPERATIONS',
  'WORK_AT_HEIGHT',
  'CONTRACTORS',
  'CRITICAL_MACHINERY',
  'FIRE_EXPOSURE',
  'ELECTRICITY',
  'BUSINESS_CONTINUITY',
  'QUALITY_SENSITIVITY',
  'STRATEGIC_PROTECTION_PRIORITIES',
  'CURRENT_STATE_CONTROLS',
  'EVIDENCE_AVAILABILITY',
  'DESIRED_INSPECTION_DEPTH',
  'PROJECT_CHANGES',
]);
export type FutureContextKey = z.infer<typeof futureContextKeySchema>;

const workCenterSchema = z
  .object({
    workCenterId: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
    displayName: z.string().trim().min(1).max(120),
    workerCount: z.number().int().min(1).max(10_000_000).optional(),
    economicActivities: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
    riskClassificationHypothesis: z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']),
    facilityType: z.enum([
      'OFFICE',
      'WAREHOUSE',
      'MANUFACTURING',
      'LABORATORY',
      'CONSTRUCTION_PROJECT',
      'MIXED',
    ]),
    operationalIndicators: z
      .array(
        z.enum([
          'CHEMICAL_HANDLING',
          'HIGH_ENERGY_EQUIPMENT',
          'TRANSPORT_FLEET',
          'WORK_AT_HEIGHT',
          'CONTRACTOR_PRESENCE',
          'CRITICAL_MACHINERY',
          'FIRE_LOAD',
          'ELECTRICAL_EXPOSURE',
          'PROJECT_CHANGE',
        ]),
      )
      .max(12),
  })
  .strict();

const operationalContextSchema = z
  .object({
    transportOperations: z.boolean(),
    workAtHeight: z.boolean(),
    contractors: z.boolean(),
    criticalMachinery: z.boolean(),
    fireExposure: z.boolean(),
    electricityExposure: z.boolean(),
    projectChanges: z.boolean(),
    businessContinuityCriticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']),
    qualitySensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']),
    notes: z.array(z.string().trim().min(1).max(300)).max(12),
  })
  .strict();

const currentStateHypothesisSchema = z
  .object({
    targetKey: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
    implementationState: implementationHypothesisSchema,
    evidence: evidenceHypothesisSchema,
    note: z.string().trim().min(1).max(300),
  })
  .strict();

const expectedDecisionSchema = z
  .object({
    targetKey: z.string().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
    state: applicabilityStateSchema,
    winningRuleId: z
      .string()
      .regex(/^[A-Z][A-Z0-9_]{2,79}$/)
      .nullable(),
  })
  .strict();

const expertValidationSchema = z
  .object({
    status: expertValidationStatusSchema,
    expectedApplicability: z.string().trim().min(1).max(500).nullable(),
    missingInformation: z.array(z.string().trim().min(1).max(300)).max(20),
    variablesToAdd: z.array(z.string().trim().min(1).max(160)).max(20),
    organizationVsWorkCenterScope: z.string().trim().min(1).max(500).nullable(),
    expectedDepth: depthLevelSchema.nullable(),
    currentStateQuestions: z.array(z.string().trim().min(1).max(300)).max(20),
    recommendedNextStep: z.string().trim().min(1).max(500).nullable(),
    confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
    comments: z.string().trim().min(1).max(1_000).nullable(),
    agreementWithEngineOutcome: z
      .enum(['AGREES', 'PARTIALLY_AGREES', 'DISAGREES', 'NEEDS_MORE_INFORMATION'])
      .nullable(),
    questions: z.array(z.string().trim().min(1).max(300)).min(1).max(20),
  })
  .strict();

export const sstValidationScenarioSchema = z
  .object({
    schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION),
    scenarioVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    id: z.string().regex(/^EC_(?:DEMO|EXPERT)_[A-Z0-9_]{3,70}$/),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(500),
    scenarioKind: scenarioKindSchema,
    synthetic: z.boolean(),
    profileV1Input: organizationSstProfileSchema,
    organizationContext: z
      .object({
        summary: z.string().trim().min(1).max(500),
        sizeHypothesis: z.enum(['SMALL', 'MEDIUM', 'LARGE']),
        economicActivitySummary: z.string().trim().min(1).max(300),
      })
      .strict(),
    workCenters: z.array(workCenterSchema).min(1).max(20),
    operationalContext: operationalContextSchema,
    futureContextNotEvaluated: z.array(futureContextKeySchema).min(1),
    strategicProtectionPriorities: z.array(strategicProtectionPrioritySchema).min(1),
    currentStateHypotheses: z.array(currentStateHypothesisSchema).min(1).max(20),
    depthHypothesis: z
      .object({
        level: depthLevelSchema,
        rationale: z.string().trim().min(1).max(500),
      })
      .strict(),
    engineExpectation: z
      .object({
        basis: z.literal('DEMO_APPLICABILITY_V1_0_0'),
        decisions: z.array(expectedDecisionSchema).min(1),
      })
      .strict(),
    expertValidation: expertValidationSchema,
  })
  .strict()
  .superRefine((scenario, context) => {
    if (scenario.scenarioKind === 'SYNTHETIC' && !scenario.synthetic) {
      context.addIssue({
        code: 'custom',
        path: ['synthetic'],
        message: 'Synthetic scenarios must set synthetic=true',
      });
    }
    if (scenario.scenarioKind === 'PSEUDONYMIZED_EXPERT_CASE' && scenario.synthetic) {
      context.addIssue({
        code: 'custom',
        path: ['synthetic'],
        message: 'Pseudonymized expert cases must set synthetic=false',
      });
    }
    if (scenario.workCenters.length !== scenario.profileV1Input.organization.workCenterCount) {
      context.addIssue({
        code: 'custom',
        path: ['workCenters'],
        message: 'Work-center metadata must match Profile V1 workCenterCount',
      });
    }
    const workCenterIds = scenario.workCenters.map(({ workCenterId }) => workCenterId);
    if (new Set(workCenterIds).size !== workCenterIds.length) {
      context.addIssue({
        code: 'custom',
        path: ['workCenters'],
        message: 'Work-center ids must be unique within a scenario',
      });
    }
    const targets = scenario.engineExpectation.decisions.map(({ targetKey }) => targetKey);
    if (new Set(targets).size !== targets.length) {
      context.addIssue({
        code: 'custom',
        path: ['engineExpectation', 'decisions'],
        message: 'Expected target keys must be unique',
      });
    }
  });

export type SstValidationScenario = z.infer<typeof sstValidationScenarioSchema>;
