'use client';

import type { SstAssessmentQuestion } from '@sst/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  assessmentErrorMessage,
  assessmentQuestionScopeContext,
  assessmentTopicLabel,
  orderAssessmentQuestions,
  resolveAssessmentPresentationScopes,
  editableQuestionForFact,
  visibleFactSummaries,
} from '@/lib/sst-assessment-presentation';
import {
  assessmentCenterRelay,
  assessmentProcessingAnswer,
  assessmentContextChanges,
  type AssessmentContextChange,
} from '@/lib/sst-assessment-visual-feedback';
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
import { AssessmentProcessingScene } from './assessment-processing-scene';

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
  const [processingAnswer, setProcessingAnswer] = useState<string>();
  const [savedMessage, setSavedMessage] = useState<string>();
  const [changes, setChanges] = useState<AssessmentContextChange[]>([]);
  const [relay, setRelay] = useState<ReturnType<typeof assessmentCenterRelay>>(null);
  const sceneTitleRef = useRef<HTMLHeadingElement>(null);
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
  const scopeContext = displayedQuestion
    ? assessmentQuestionScopeContext(displayedQuestion, session.snapshot.facts, presentationScopes)
    : null;

  useEffect(() => {
    if (!changes.length) return;
    const expiry = window.setTimeout(() => setChanges([]), 4_000);
    return () => window.clearTimeout(expiry);
  }, [changes]);
  useEffect(() => {
    if (relay || checkpointTopic) sceneTitleRef.current?.focus({ preventScroll: true });
  }, [relay, checkpointTopic]);

  function edit(question: SstAssessmentQuestion) {
    setCheckpointTopic(null);
    setRelay(null);
    setEditing(question);
  }
  const status = <AssessmentSaveStatus status={saveStatus} message={savedMessage} />;
  const processing = (
    <AssessmentProcessingScene busy={busy} status={saveStatus} answerText={processingAnswer} />
  );
  const confirmed = visibleFactSummaries(session.snapshot.facts, presentationScopes);
  const checkpointFacts = session.snapshot.facts.filter((fact) => {
    const scope = presentationScopes.find(({ scopeKey }) => scopeKey === fact.scopeKey);
    const question = scope ? editableQuestionForFact(fact, scope) : null;
    return (
      question &&
      assessmentTopicLabel(question.topic) === assessmentTopicLabel(checkpointTopic ?? '')
    );
  });

  async function evaluateContext() {
    setProcessingAnswer(undefined);
    setError('');
    setSaveStatus('evaluating');
    try {
      onSessionChange(await transport.evaluate(session.sessionRevision));
      setSaveStatus('saved');
    } catch (cause) {
      setError(assessmentErrorMessage(cause));
      setSaveStatus('idle');
    }
  }

  async function answer(answerValue: AssessmentAnswer) {
    if (busy) return;
    const before = session.snapshot.facts;
    const outgoing = displayedQuestion;
    setError('');
    setProcessingAnswer(assessmentProcessingAnswer(answerValue));
    setSaveStatus('saving');
    try {
      const saved = await transport.submitAnswers(session.sessionRevision, [answerValue]);
      setSaveStatus('evaluating');
      const evaluated = await transport.evaluate(saved.sessionRevision);
      const next = orderAssessmentQuestions(evaluated.questions).find(
        (question) =>
          question.collectionPolicy !== 'COMMERCIAL_OPTIONAL' &&
          !skipped.includes(question.questionId) &&
          (!collectingOptionalContext || !question.blocking),
      );
      if (
        next &&
        outgoing &&
        assessmentTopicLabel(next.topic) !== assessmentTopicLabel(outgoing.topic)
      )
        setCheckpointTopic(outgoing.topic);
      setRelay(assessmentCenterRelay(outgoing?.scopeKey, next?.scopeKey, presentationScopes));
      setChanges(assessmentContextChanges(before, evaluated.snapshot.facts, presentationScopes));
      const answeredScope = outgoing
        ? assessmentQuestionScopeContext(outgoing, session.snapshot.facts, presentationScopes)
        : null;
      setSavedMessage(
        answeredScope
          ? `Guardado en ${answeredScope.label.split(' de ')[0]}`
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
    setProcessingAnswer(undefined);
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
      onEdit={edit}
      activeScopeKey={displayedQuestion?.scopeKey}
      changes={changes}
      disabled={busy}
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
          finalized
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
  if (session.status === 'DIAGNOSIS_READY' && !editing && !collectingOptionalContext && !relay) {
    return (
      <AssessmentShell
        title="Revisa antes de finalizar"
        description="Puedes corregir cualquier respuesta. El diagnóstico se genera solo cuando confirmas."
        aside={aside}
        progress={<AssessmentProgress progress={session.progress} diagnosisReady />}
      >
        <AssessmentReview
          facts={session.snapshot.facts}
          scopes={presentationScopes}
          busy={busy}
          hasOptionalContext={optionalQuestions.length > 0}
          optionalQuestions={optionalQuestions}
          saveStatus={status}
          processing={processing}
          onConfirm={() => void finalize()}
          onEdit={edit}
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
      scope={
        !relay && !checkpointTopic && scopeContext ? (
          <div className="assessment-mobile-scope">
            <strong>{scopeContext.label}</strong>
            <span>{scopeContext.name}</span>
            <small>{scopeContext.summary}</small>
          </div>
        ) : undefined
      }
      progress={
        <AssessmentProgress
          progress={session.progress}
          activeTopic={checkpointTopic ?? displayedQuestion?.topic}
          diagnosisReady={session.status === 'DIAGNOSIS_READY'}
        />
      }
    >
      {relay ? (
        <section
          className="assessment-checkpoint assessment-relay"
          aria-labelledby="assessment-relay-title"
        >
          <div className="assessment-relay__scopes">
            <div>
              <span>Revisado por ahora</span>
              <strong>
                {relay.fromLabel}
                {relay.from.displayName !== relay.fromLabel ? ` · ${relay.from.displayName}` : ''}
              </strong>
            </div>
            <span aria-hidden="true">→</span>
            <div>
              <span>
                Ahora · {relay.toLabel} de {relay.total}
              </span>
              <strong>{relay.to.displayName}</strong>
            </div>
          </div>
          <p>Terminamos por ahora con {relay.fromLabel}.</p>
          <h2 id="assessment-relay-title" ref={sceneTitleRef} tabIndex={-1}>
            Ahora revisaremos {relay.toLabel}
          </h2>
          <p>Las siguientes preguntas se adaptarán a lo que confirmes de este centro.</p>
          <div className="assessment-recap">
            {confirmed
              .filter(({ scopeKey }) => scopeKey === relay.from.scopeKey)
              .slice(0, 3)
              .map((fact) => (
                <div key={fact.identity}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
          </div>
          <div className="assessment-actions">
            <button className="button" type="button" onClick={() => setRelay(null)}>
              Empezar con {relay.toLabel} <span aria-hidden="true">→</span>
            </button>
          </div>
          {status}
        </section>
      ) : checkpointTopic ? (
        <section className="assessment-checkpoint">
          <p className="eyebrow">Área revisada · {assessmentTopicLabel(checkpointTopic)}</p>
          <h2 ref={sceneTitleRef} tabIndex={-1}>
            Revisamos {assessmentTopicLabel(checkpointTopic)}
          </h2>
          <p>
            La información confirmada ya aparece en “Contexto confirmado”. Puedes corregirla antes
            de seguir.
          </p>
          <div className="assessment-recap">
            {visibleFactSummaries(checkpointFacts, presentationScopes)
              .slice(0, 3)
              .map((fact) => (
                <div key={fact.identity}>
                  <span>
                    {fact.scopeName} · {fact.label}
                  </span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
          </div>
          {displayedQuestion ? (
            <p>
              Después: {assessmentTopicLabel(displayedQuestion.topic)}. Seguiremos con el contexto
              que confirmes.
            </p>
          ) : null}
          <div className="assessment-actions">
            {checkpointFacts.length ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  const fact = checkpointFacts[0]!;
                  const scope = presentationScopes.find(
                    ({ scopeKey }) => scopeKey === fact.scopeKey,
                  )!;
                  const question = editableQuestionForFact(fact, scope);
                  if (question) edit(question);
                }}
              >
                Corregir información
              </button>
            ) : null}
            {transport.channel === 'PUBLIC' && publicPersistenceAvailable ? (
              <a className="button secondary" href="/">
                Continuar después
              </a>
            ) : null}
            <button className="button" type="button" onClick={() => setCheckpointTopic(null)}>
              Todo correcto, continuar
            </button>
          </div>
          {status}
        </section>
      ) : displayedQuestion ? (
        <AssessmentQuestionCard
          question={displayedQuestion}
          disabled={busy}
          focusOnMount
          facts={session.snapshot.facts}
          scopes={presentationScopes}
          canContinueLater={transport.channel === 'PUBLIC' && publicPersistenceAvailable}
          saveStatus={status}
          processing={processing}
          error={error}
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
              onClick={() => void evaluateContext()}
            >
              Preparar revisión
            </button>
          )}
          {status}
          {processing}
        </section>
      )}
      {collectingOptionalContext ? (
        <button
          className="button secondary assessment-optional-exit"
          type="button"
          disabled={busy}
          onClick={() => setCollectingOptionalContext(false)}
        >
          Terminar contexto adicional y volver a la revisión
        </button>
      ) : null}
      {error && !displayedQuestion ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </AssessmentShell>
  );
}
