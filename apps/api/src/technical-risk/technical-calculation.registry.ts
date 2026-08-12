import { Injectable } from '@nestjs/common';
import {
  DemoTechnicalRiskCalculator,
  TechnicalCalculationRegistry as ContractRegistry,
  type TechnicalAnswerSet,
  type TechnicalMethodVersionSnapshot,
} from '@sst/contracts';

@Injectable()
export class TechnicalCalculationRegistry {
  private readonly registry = new ContractRegistry([new DemoTechnicalRiskCalculator()]);

  calculate(method: TechnicalMethodVersionSnapshot, answers: TechnicalAnswerSet) {
    return this.registry.get(method.calculationKey).calculate(method, answers);
  }
}
