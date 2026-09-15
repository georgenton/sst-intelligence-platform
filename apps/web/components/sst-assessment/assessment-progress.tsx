import type { SstAssessmentProgress } from '@sst/contracts';
import { aggregateAssessmentProgress } from '@/lib/sst-assessment-presentation';

export function AssessmentProgress({
  progress,
  activeTopic,
  diagnosisReady = false,
}: {
  progress: SstAssessmentProgress;
  activeTopic?: string;
  diagnosisReady?: boolean;
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
              {topic.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
