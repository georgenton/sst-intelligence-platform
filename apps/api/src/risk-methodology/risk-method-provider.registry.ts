import { z } from 'zod';
import {
  calculateDemoRisk,
  calculateGtc45Specification,
  calculateGuided5x5Specification,
  gtc45SpecificationInputSchema,
  guided5x5SpecificationInputSchema,
  type Gtc45SpecificationInput,
  type Gtc45SpecificationResult,
  type Guided5x5SpecificationInput,
  type RiskMethodExplanation,
  type RiskMethodProvider,
} from '@sst/contracts';

const demoInputSchema = z.object({
  likelihood: z.number().int().min(1).max(5),
  consequence: z.number().int().min(1).max(5),
});

export type Demo5x5Input = z.infer<typeof demoInputSchema>;
export type Demo5x5Result = ReturnType<typeof calculateDemoRisk>;

class Demo5x5Provider implements RiskMethodProvider<Demo5x5Input, Demo5x5Result> {
  readonly providerKey = 'HISTORICAL_DEMO_5X5';
  readonly providerVersion = '1.0.0';

  validateInput(input: unknown) {
    return demoInputSchema.parse(input);
  }

  calculate(input: Demo5x5Input) {
    return calculateDemoRisk(input.likelihood, input.consequence);
  }

  explainResult(_: Demo5x5Input, result: Demo5x5Result): RiskMethodExplanation {
    return {
      heading: `Nivel ${result.level}`,
      summary: `Probabilidad ${result.likelihood} por consecuencia ${result.consequence}: ${result.score}.`,
      methodDisclosure: 'Matriz demostrativa histórica 5×5 · v1.0.0.',
    };
  }

  validateResidualInput(_: Demo5x5Input, residual: unknown) {
    return this.validateInput(residual);
  }

  calculateResidual(_: Demo5x5Input, residual: Demo5x5Input) {
    return this.calculate(residual);
  }
}

class Guided5x5Provider implements RiskMethodProvider<
  Guided5x5SpecificationInput,
  ReturnType<typeof calculateGuided5x5Specification>
> {
  readonly providerKey = 'GUIDED_5X5';
  readonly providerVersion = '1.0.0';

  validateInput(input: unknown) {
    return guided5x5SpecificationInputSchema.parse(input);
  }

  calculate(input: Guided5x5SpecificationInput) {
    return calculateGuided5x5Specification(input);
  }

  explainResult(
    _: Guided5x5SpecificationInput,
    result: ReturnType<typeof calculateGuided5x5Specification>,
  ): RiskMethodExplanation {
    return {
      heading: `Nivel ${result.level}`,
      summary: `${result.explanation.probability.label} por ${result.explanation.severity.label}: ${result.score}.`,
      methodDisclosure: 'Matriz 5×5 guiada · v1.0.0 · candidato DEMO.',
    };
  }

  validateResidualInput(_: Guided5x5SpecificationInput, residual: unknown) {
    return this.validateInput(residual);
  }

  calculateResidual(_: Guided5x5SpecificationInput, residual: Guided5x5SpecificationInput) {
    return this.calculate(residual);
  }
}

class Gtc45Provider implements RiskMethodProvider<
  Gtc45SpecificationInput,
  Gtc45SpecificationResult
> {
  readonly providerKey = 'GTC45_2010_CANONICAL';
  readonly providerVersion = '1.0.0';

  validateInput(input: unknown) {
    return gtc45SpecificationInputSchema.parse(input);
  }

  calculate(input: Gtc45SpecificationInput) {
    return calculateGtc45Specification(input);
  }

  explainResult(_: Gtc45SpecificationInput, result: Gtc45SpecificationResult) {
    return {
      heading: `Nivel de intervención ${result.riskLevel}`,
      summary:
        result.specialHandling === 'LOW_DEFICIENCY_DIRECT_TO_IV'
          ? 'Deficiencia baja: clasificación especial directa IV, sin convertir ND en cero.'
          : `NP ${result.probabilityValue}; NR ${result.riskValue}; nivel ${result.riskLevel}.`,
      methodDisclosure: 'GTC 45 · edición 2010 · v1.0.0 · método candidato para revisión.',
    };
  }

  validateResidualInput(_: Gtc45SpecificationInput, residual: unknown) {
    return this.validateInput(residual);
  }

  calculateResidual(_: Gtc45SpecificationInput, residual: Gtc45SpecificationInput) {
    return this.calculate(residual);
  }
}

export const RISK_METHOD_PROVIDER_REGISTRY = {
  HISTORICAL_DEMO_5X5: new Demo5x5Provider(),
  GUIDED_5X5: new Guided5x5Provider(),
  GTC45_2010_CANONICAL: new Gtc45Provider(),
} as const;

export type RiskMethodProviderKey = keyof typeof RISK_METHOD_PROVIDER_REGISTRY;

export function riskMethodProvider(providerKey: string) {
  return RISK_METHOD_PROVIDER_REGISTRY[providerKey as RiskMethodProviderKey];
}
