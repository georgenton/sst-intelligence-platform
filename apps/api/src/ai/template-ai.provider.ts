import { Injectable } from '@nestjs/common';
import type { AiProvider, AiResult, ExplainInput } from './ai.types';

@Injectable()
export class TemplateAiProvider implements AiProvider {
  async explain(input: ExplainInput): Promise<AiResult> {
    const names = input.recommendation.recommendedModules.map((item) => item.moduleKey).join(', ');
    return {
      provider: 'template',
      explanation: {
        headline: 'Una ruta SST modular basada en tus respuestas',
        executiveSummary: `La recomendación prioriza ${names}. El cálculo fue realizado por reglas determinísticas versionadas.`,
        moduleExplanations: input.recommendation.recommendedModules.map((item) => ({
          moduleKey: item.moduleKey,
          why: item.reasons.join('. '),
          expectedValue:
            item.moduleKey === 'CORE'
              ? 'Establecer una base común de acceso y trazabilidad.'
              : 'Centralizar seguimiento y reducir reprocesos mediante una implementación gradual.',
        })),
        rolloutExplanation:
          input.recommendation.suggestedRollout.length > 1
            ? 'El presupuesto o la preferencia indicada sugieren implementar por fases sin eliminar necesidades detectadas.'
            : 'La escala y preferencia indicadas permiten iniciar los módulos recomendados en una primera fase.',
        disclaimer:
          'Explicación comercial orientativa; no constituye evaluación técnica, diagnóstico ni garantía de cumplimiento legal.',
      },
    };
  }
}
