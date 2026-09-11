import type { SstAssessmentProgress } from '@sst/contracts';
import { assessmentTopicLabel } from '@/lib/sst-assessment-presentation';

export function AssessmentProgress({
  progress,
  activeTopic,
}: {
  progress: SstAssessmentProgress;
  activeTopic?: string;
}) {
  const topics = progress.topics.map((topic) => ({
    ...topic,
    label: assessmentTopicLabel(topic.topic),
  }));
  const unique = [...new Map(topics.map((topic) => [topic.label, topic])).values()];
  return (
    <section className="assessment-progress" aria-label="Progreso por temas">
      <div className="assessment-progress__summary">
        <strong>
          {progress.completedTopics} de {progress.totalTopics} temas con información suficiente
        </strong>
        <span>El progreso describe información, no cumplimiento.</span>
      </div>
      <ol>
        {unique.map((topic) => {
          const active = assessmentTopicLabel(activeTopic ?? '') === topic.label;
          return (
            <li
              key={topic.label}
              data-state={topic.complete ? 'complete' : active ? 'active' : 'pending'}
            >
              <span aria-hidden="true">{topic.complete ? '✓' : active ? '●' : '○'}</span>
              {topic.label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
