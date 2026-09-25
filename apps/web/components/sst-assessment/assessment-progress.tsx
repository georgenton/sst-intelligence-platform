import type { SstAssessmentProgress } from '@sst/contracts';
import { aggregateAssessmentProgress } from '@/lib/sst-assessment-presentation';

export function AssessmentProgress({
  progress,
  activeTopic,
  diagnosisReady = false,
  readinessAnnouncement = false,
}: {
  progress: SstAssessmentProgress;
  activeTopic?: string;
  diagnosisReady?: boolean;
  readinessAnnouncement?: boolean;
}) {
  const humanProgress = aggregateAssessmentProgress(progress, activeTopic);
  return (
    <section className="assessment-progress" aria-label="Áreas de contexto">
      <div className="assessment-progress__summary">
        <strong>
          {diagnosisReady
            ? 'Información mínima para el diagnóstico completada'
            : `${humanProgress.completedTopics} de ${humanProgress.totalTopics} áreas de contexto con información suficiente`}
        </strong>
        {readinessAnnouncement ? (
          <p
            className="assessment-progress__readiness-announcement"
            role="status"
            aria-live="polite"
            data-readiness-announcement="true"
          >
            Ya tenemos la información mínima para generar tu diagnóstico. Puedes revisar lo
            confirmado o añadir contexto opcional.
          </p>
        ) : null}
        <div className="assessment-progress__support" aria-hidden="true">
          <span
            style={{
              width: `${humanProgress.totalTopics ? (humanProgress.completedTopics / humanProgress.totalTopics) * 100 : 0}%`,
            }}
          />
        </div>
        <span>
          {diagnosisReady
            ? `${humanProgress.completedTopics} de ${humanProgress.totalTopics} áreas tienen contexto adicional. Puedes profundizar de forma opcional.`
            : 'El progreso describe información, no cumplimiento.'}
        </span>
      </div>
      <ol>
        {humanProgress.topics.map((topic) => {
          return (
            <li
              key={topic.label}
              data-state={topic.complete ? 'complete' : topic.active ? 'active' : 'pending'}
            >
              <span aria-hidden="true">{topic.complete ? '✓' : topic.active ? '●' : '○'}</span>
              <span className="assessment-progress__label">{topic.label}</span>
              <span className="sr-only">
                {topic.complete
                  ? ': con información'
                  : topic.active
                    ? ': actual'
                    : ': por explorar'}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="assessment-progress__note">
        {diagnosisReady
          ? 'La profundidad adicional es opcional. El progreso describe información, no cumplimiento.'
          : 'Te avisaremos cuando haya información suficiente para generar el diagnóstico. Las siguientes preguntas se adaptarán a lo que confirmes.'}
      </p>
    </section>
  );
}
