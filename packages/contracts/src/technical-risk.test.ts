import { describe, expect, it } from 'vitest';
import {
  DEMO_TECHNICAL_RISK_METHOD,
  DemoTechnicalRiskCalculator,
  TechnicalCalculationRegistry,
  assertTechnicalAssessmentTransition,
  technicalMethodSchema,
  technicalReviewTargetStatus,
  validateTechnicalAnswer,
  validateTechnicalAnswerSet,
} from './technical-risk';

describe('technical method schema and answers', () => {
  it('validates the controlled demo schema', () => {
    expect(technicalMethodSchema.parse(DEMO_TECHNICAL_RISK_METHOD.schema)).toBeTruthy();
  });

  it('rejects unknown questions and incorrect answer types', () => {
    expect(() => validateTechnicalAnswer(DEMO_TECHNICAL_RISK_METHOD.schema, 'unknown', 1)).toThrow(
      'UNKNOWN_TECHNICAL_QUESTION',
    );
    expect(() =>
      validateTechnicalAnswer(DEMO_TECHNICAL_RISK_METHOD.schema, 'likelihood', '4'),
    ).toThrow('INVALID_TECHNICAL_ANSWER');
  });

  it('rejects missing required answers', () => {
    expect(() =>
      validateTechnicalAnswerSet(DEMO_TECHNICAL_RISK_METHOD.schema, {
        activityDescription: 'Actividad sintética',
        likelihood: 4,
      }),
    ).toThrow('MISSING_TECHNICAL_ANSWER:consequence');
  });
});

describe('technical calculation registry', () => {
  const calculator = new DemoTechnicalRiskCalculator();
  const registry = new TechnicalCalculationRegistry([calculator]);

  it('resolves a known provider and rejects an unknown provider', () => {
    expect(registry.get(calculator.key)).toBe(calculator);
    expect(() => registry.get('ARBITRARY_FORMULA')).toThrow(
      'UNKNOWN_TECHNICAL_CALCULATION_PROVIDER',
    );
  });

  it.each([
    [1, 1, 1, 'LOW'],
    [1, 4, 4, 'LOW'],
    [1, 5, 5, 'MODERATE'],
    [3, 3, 9, 'MODERATE'],
    [2, 5, 10, 'HIGH'],
    [4, 4, 16, 'HIGH'],
    [4, 5, 20, 'CRITICAL'],
    [5, 5, 25, 'CRITICAL'],
  ])('calculates boundary %s×%s as %s %s', (likelihood, consequence, score, level) => {
    const result = calculator.calculate(DEMO_TECHNICAL_RISK_METHOD, {
      activityDescription: 'Actividad sintética',
      likelihood,
      consequence,
    });
    expect(result).toMatchObject({ score, level });
  });
});

describe('technical assessment transitions', () => {
  it.each([
    ['DRAFT', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'COMPLETED'],
    ['COMPLETED', 'REVIEWED'],
  ] as const)('allows %s to %s', (from, to) => {
    expect(() => assertTechnicalAssessmentTransition(from, to)).not.toThrow();
  });

  it.each([
    ['DRAFT', 'COMPLETED'],
    ['IN_PROGRESS', 'REVIEWED'],
    ['REVIEWED', 'COMPLETED'],
  ] as const)('rejects %s to %s', (from, to) => {
    expect(() => assertTechnicalAssessmentTransition(from, to)).toThrow(
      'INVALID_TECHNICAL_ASSESSMENT_TRANSITION',
    );
  });

  it('keeps NEEDS_REVISION completed and moves APPROVED to reviewed', () => {
    expect(technicalReviewTargetStatus('COMPLETED', 'NEEDS_REVISION')).toBe('COMPLETED');
    expect(technicalReviewTargetStatus('COMPLETED', 'APPROVED')).toBe('REVIEWED');
    expect(() => technicalReviewTargetStatus('IN_PROGRESS', 'APPROVED')).toThrow(
      'ASSESSMENT_NOT_READY_FOR_REVIEW',
    );
  });
});
