'use client';

import type { SstAssessmentQuestion } from '@sst/contracts';
import { useMemo, useState } from 'react';
import {
  assessmentErrorMessage,
  assessmentQuestionScopeContext,
  assessmentTopicLabel,
  orderAssessmentQuestions,
  resolveAssessmentPresentationScopes,
} from '@/lib/sst-assessment-presentation';
import type {
  AssessmentAnswer,
  AssessmentSession,
  AssessmentTransport,
} from '@/lib/sst-assessment-types';
import { AssessmentContextPanel } from './assessment-context-panel';
import { AssessmentProgress } from './assessment-progress';
import { AssessmentQuestionCard } from './assessment-question-card';
import { AssessmentResults } from './assessment-results';
import { AssessmentReview } from './assessment-review';
import { AssessmentSaveStatus } from './assessment-save-status';
import { AssessmentShell } from './assessment-shell';

export function GuidedSstAssessmentExperience({
  session,
  transport,
  continuation,
  onSessionChange,
  onReassess,
  features,
  publicPersistenceAvailable = false,
}: {
  session: AssessmentSession;
  transport: AssessmentTransport;
  continuation?: 'public' | 'authenticated';
  onSessionChange(session: AssessmentSession): void;
  onReassess?: () => void;
  features?: Record<string, boolean | number | string>;
  publicPersistenceAvailable?: boolean;
}) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'evaluating' | 'saved'>('idle');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<SstAssessmentQuestion | null>(null);
  const [collectingOptionalContext, setCollectingOptionalContext] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [checkpointTopic, setCheckpointTopic] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string>();
  const presentationScopes = useMemo(
    () => resolveAssessmentPresentationScopes(session.snapshot.scopes, session.claimScopeMappings),
    [session.claimScopeMappings, session.snapshot.scopes],
  );
  const questions = useMemo(
    () =>
      orderAssessmentQuestions(session.questions).filter(
        (question) =>
          question.collectionPolicy !== 'COMMERCIAL_OPTIONAL' &&
          !skipped.includes(question.questionId),
      ),
    [session.questions, skipped],
  );
  const optionalQuestions = questions.filter((question) => !question.blocking);
  const currentQuestion = editing ?? questions[0];
  const displayedQuestion =
    editing ?? (collectingOptionalContext ? optionalQuestions[0] : currentQuestion);
  const busy = saveStatus === 'saving' || saveStatus === 'evaluating';

  async function answer(answerValue: AssessmentAnswer) {
    setError('');
    setSaveStatus('saving');
    try {
      const saved = await transport.submitAnswers(session.sessionRevision, [answerValue]);
      setSaveStatus('evaluating');
      const evaluated = await transport.evaluate(saved.sessionRevision);
      const next = orderAssessmentQuestions(evaluated.questions).find(
        ({ collectionPolicy }) => collectionPolicy !== 'COMMERCIAL_OPTIONAL',
      );
      if (
        next &&
        currentQuestion &&
        assessmentTopicLabel(next.topic) !== assessmentTopicLabel(currentQuestion.topic)
      )
        setCheckpointTopic(currentQuestion.topic);
      const answeredScope = currentQuestion
        ? assessmentQuestionScopeContext(
            currentQuestion,
            session.snapshot.facts,
            presentationScopes,
          )
        : null;
      setSavedMessage(
        answeredScope
          ? `Respuesta guardada para ${answeredScope.label.toLowerCase()}`
          : 'Respuesta guardada',
      );
      setEditing(null);
      if (collectingOptionalContext && !evaluated.questions.some((question) => !question.blocking))
        setCollectingOptionalContext(false);
      onSessionChange(evaluated);
      setSaveStatus('saved');
    } catch (cause) {
      setError(assessmentErrorMessage(cause));
      try {
        onSessionChange(await transport.get());
      } catch {
        // Keep the last confirmed state visible when recovery is unavailable.
      }
      setSaveStatus('idle');
    }
  }

  async function finalize() {
    setError('');
    setSaveStatus('evaluating');
    try {
      onSessionChange(await transport.finalize(session.sessionRevision));
      setSaveStatus('saved');
    } catch (cause) {
      setError(assessmentErrorMessage(cause));
      setSaveStatus('idle');
    }
  }

  const aside = (
    <AssessmentContextPanel
      facts={session.snapshot.facts}
      scopes={presentationScopes}
      readOnly={session.status === 'FINALIZED'}
      onEdit={(question) => {
        setCheckpointTopic(null);
        setEditing(question);
      }}
    />
  );
  if (session.status === 'FINALIZED' && session.result) {
    return (
      <AssessmentShell
        title="Tu diagnóstico SST"
        description="Una lectura ejecutiva, trazable y orientativa de la información que confirmaste."
        aside={aside}
      >
        <AssessmentResults
          result={session.result}
          sessionId={session.id}
          channel={transport.channel}
          continuation={continuation}
          onReassess={onReassess}
          scopes={presentationScopes}
          features={features}
        />
      </AssessmentShell>
    );
  }
  if (session.status === 'DIAGNOSIS_READY' && !editing && !collectingOptionalContext) {
    return (
      <AssessmentShell
        title="Revisa antes de finalizar"
        description="Puedes corregir cualquier respuesta. El diagnóstico se genera solo cuando confirmas."
        aside={aside}
      >
        <AssessmentProgress progress={session.progress} diagnosisReady />
        <AssessmentReview
          facts={session.snapshot.facts}
          scopes={presentationScopes}
          busy={busy}
          hasOptionalContext={optionalQuestions.length > 0}
          onConfirm={() => void finalize()}
          onEdit={setEditing}
          onAddOptionalContext={() => {
            setCheckpointTopic(null);
            setCollectingOptionalContext(true);
          }}
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </AssessmentShell>
    );
  }
  return (
    <AssessmentShell
      title="Conozcamos cómo funciona tu empresa"
      description="Te mostraremos una sola pregunta relevante por vez. Tus respuestas se guardan antes de continuar."
      aside={aside}
    >
      <AssessmentProgress
        progress={session.progress}
        activeTopic={checkpointTopic ?? displayedQuestion?.topic}
        diagnosisReady={session.status === 'DIAGNOSIS_READY'}
      />
      {checkpointTopic ? (
        <section className="assessment-checkpoint">
          <p className="assessment-assistant">Hasta ahora entiendo esto de tu empresa.</p>
          <h2>Revisamos {assessmentTopicLabel(checkpointTopic)}</h2>
          <p>
            La información confirmada ya aparece en “Contexto confirmado”. Puedes corregirla antes
            de seguir.
          </p>
          <button className="button" type="button" onClick={() => setCheckpointTopic(null)}>
            Todo correcto, continuar
          </button>
        </section>
      ) : displayedQuestion ? (
        <AssessmentQuestionCard
          question={displayedQuestion}
          disabled={busy}
          focusOnMount={Boolean(editing)}
          facts={session.snapshot.facts}
          scopes={presentationScopes}
          canContinueLater={transport.channel === 'PUBLIC' && publicPersistenceAvailable}
          onAnswer={(value) => void answer(value)}
          onSkip={() => {
            setSkipped((current) => [...current, displayedQuestion.questionId]);
            if (collectingOptionalContext && optionalQuestions.length === 1)
              setCollectingOptionalContext(false);
          }}
        />
      ) : (
        <section className="assessment-checkpoint">
          <h2>Analicemos la información confirmada</h2>
          {collectingOptionalContext ? (
            <button
              className="button"
              type="button"
              onClick={() => setCollectingOptionalContext(false)}
            >
              Volver a la revisión
            </button>
          ) : (
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() =>
                void transport
                  .evaluate(session.sessionRevision)
                  .then(onSessionChange)
                  .catch((cause) => setError(assessmentErrorMessage(cause)))
              }
            >
              Preparar revisión
            </button>
          )}
        </section>
      )}
      {collectingOptionalContext ? (
        <button
          className="button secondary assessment-optional-exit"
          type="button"
          onClick={() => setCollectingOptionalContext(false)}
        >
          Terminar contexto adicional y volver a la revisión
        </button>
      ) : null}
      <AssessmentSaveStatus status={saveStatus} message={savedMessage} />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </AssessmentShell>
  );
}
