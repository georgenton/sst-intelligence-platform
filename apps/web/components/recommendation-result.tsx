'use client';

import { apiRequest } from '@sst/api-client';
import type { RecommendationExplanation, SolutionRecommendation } from '@sst/contracts';
import { Card, StatusBadge } from '@sst/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from './auth-provider';
import { RecommendationSummary, SessionPersistence } from './guided';

type Session = {
  recommendation: {
    result: SolutionRecommendation;
    explanation: RecommendationExplanation;
    explanationMode: string;
  };
};

export function RecommendationResult() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const auth = useAuth();
  const query = useQuery({
    queryKey: ['solution-result', sessionId],
    queryFn: () => {
      const token = SessionPersistence.load(sessionId);
      if (!token) throw new Error('No encontramos el token de la sesión.');
      return apiRequest<Session>(
        `/solution-finder/sessions/${sessionId}`,
        {},
        { sessionToken: token },
      );
    },
  });
  if (query.isLoading) return <p>Cargando recomendación…</p>;
  if (query.isError || !query.data?.recommendation)
    return (
      <Card>
        <p role="alert" className="field-error">
          No pudimos cargar la recomendación.
        </p>
      </Card>
    );
  const { result, explanation, explanationMode } = query.data.recommendation;
  return (
    <div className="stack">
      <RecommendationSummary>
        <div>
          <StatusBadge>Motor {result.engineVersion}</StatusBadge>
          <h1>{explanation.headline}</h1>
          <p className="muted">{explanation.executiveSummary}</p>
        </div>
        <div className="module-list">
          {result.recommendedModules.map((module) => {
            const detail = explanation.moduleExplanations.find(
              (item) => item.moduleKey === module.moduleKey,
            );
            return (
              <Card className="module-row" key={module.moduleKey}>
                <div>
                  <p className="eyebrow">Prioridad {module.priority}</p>
                  <h3>{module.moduleKey.replaceAll('_', ' ')}</h3>
                  <p className="muted">{detail?.why ?? module.reasons.join('. ')}</p>
                </div>
                <strong>{module.score}/100</strong>
              </Card>
            );
          })}
        </div>
        <Card>
          <p className="eyebrow">Plan provisional</p>
          <h3>{result.suggestedPlan}</h3>
          <p>{explanation.rolloutExplanation}</p>
        </Card>
        <p className="muted">
          <strong>Explicación:</strong> {explanationMode}. {explanation.disclaimer}
        </p>
      </RecommendationSummary>
      <Card className="stack">
        <h2>Activa un workspace de demostración</h2>
        <p className="muted">
          Los indicadores serán sintéticos y estarán identificados como “Demostración conceptual”.
        </p>
        <div>
          <Link
            className="button"
            href={
              auth.user
                ? `/app/organizations?sessionId=${sessionId}`
                : `/auth/register?sessionId=${sessionId}`
            }
          >
            {auth.user ? 'Elegir organización' : 'Crear cuenta y continuar'}
          </Link>
        </div>
      </Card>
    </div>
  );
}
