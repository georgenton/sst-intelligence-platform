import type { SstAssessmentProgress } from '@sst/contracts';
import { aggregateAssessmentProgress } from '@/lib/sst-assessment-presentation';

export function AssessmentProgress({
  progress,
  activeTopic,
}: {
  progress: SstAssessmentProgress;
  activeTopic?: string;
}) {
  const humanProgress = aggregateAssessmentProgress(progress, activeTopic);
  return (
    <section className="assessment-progress" aria-label="Progreso por temas">
      <div className="assessment-progress__summary">
        <strong>
          {humanProgress.completedTopics} de {humanProgress.totalTopics} temas con información
          suficiente
        </strong>
        <span>El progreso describe información, no cumplimiento.</span>
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
