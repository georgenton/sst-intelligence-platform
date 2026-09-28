import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the production TSX components; no browser timers or source-string assertions.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith('@/') ||
      (specifier.startsWith('.') &&
        /\.(tsx|ts)$/.test(context.parentURL ?? '') &&
        !/\.[a-z]+$/.test(specifier))
    ) {
      const base = specifier.startsWith('@/')
        ? new URL(`../${specifier.slice(2)}`, import.meta.url)
        : new URL(specifier, context.parentURL);
      for (const suffix of ['.ts', '.tsx']) {
        const url = `${base.href}${suffix}`;
        if (existsSync(fileURLToPath(url))) return nextResolve(url, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.tsx'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
        }).outputText,
      };
    return nextLoad(url, context);
  },
});
const { assessmentContextChanges, assessmentCenterRelay, assessmentProcessingAnswer } =
  await import('../lib/sst-assessment-visual-feedback.ts');
const { AssessmentProgress } = await import('../components/sst-assessment/assessment-progress.tsx');
const { AssessmentQuestionCard } =
  await import('../components/sst-assessment/assessment-question-card.tsx');
const { AssessmentSaveStatus } =
  await import('../components/sst-assessment/assessment-save-status.tsx');
const { AssessmentReview } = await import('../components/sst-assessment/assessment-review.tsx');
const scopes = [
  { scopeKey: 'organization', kind: 'ORGANIZATION', displayName: 'Empresa', order: 0 },
  { scopeKey: 'center:1', kind: 'WORK_CENTER', displayName: 'Oficina', order: 1 },
  { scopeKey: 'center:2', kind: 'WORK_CENTER', displayName: 'Remoto', order: 2 },
];
const fact = (scopeKey, factKey, value) => ({
  scopeKey,
  factKey,
  answerState: 'KNOWN',
  value,
  provenance: { source: 'PUBLIC_DECLARATION' },
});
const noop = () => {};
const render = (component, props) => renderToStaticMarkup(createElement(component, props));
const topics = [
  'Perfil organizacional',
  'Centros de trabajo',
  'Exposiciones operativas',
  'Gestión SST',
  'Personas y organización del trabajo',
  'Prioridades',
];
for (const count of [5, 6]) {
  test(`roadmap renders exactly ${count} planned context areas`, () => {
    const html = render(AssessmentProgress, {
      progress: {
        topics: topics
          .slice(0, count)
          .map((topic) => ({ topic, answered: 0, total: 1, complete: false })),
      },
    });
    assert.equal((html.match(/<li /g) ?? []).length, count);
    assert.match(html, new RegExp(`0 de ${count} áreas de contexto`));
    assert.match(html, /El progreso describe información, no cumplimiento\./);
    assert.doesNotMatch(html, /role="progressbar"|Implementación/);
  });
}
test('diagnosis readiness stays sufficient while additional context remains optional', () => {
  const html = render(AssessmentProgress, {
    diagnosisReady: true,
    progress: { topics: [{ topic: topics[0], answered: 0, total: 1, complete: false }] },
  });
  assert.match(html, /Información mínima para el diagnóstico completada/);
  assert.match(html, /profundizar de forma opcional/);
  assert.doesNotMatch(html, /0 de 1 áreas de contexto con información suficiente/);
});
test('readiness explanation is a single polite announcement separate from the persistent state', () => {
  const html = render(AssessmentProgress, {
    diagnosisReady: true,
    readinessAnnouncement: true,
    progress: { topics: [{ topic: topics[0], answered: 0, total: 1, complete: false }] },
  });
  assert.equal((html.match(/data-readiness-announcement="true"/g) ?? []).length, 1);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /añadir contexto opcional/);
});
test('local diff distinguishes additions and corrections, ignores provenance and hides sensitive values', () => {
  const before = [fact('organization', 'organization.country', 'Ecuador')];
  const after = [
    fact('organization', 'organization.country', 'Colombia'),
    fact('center:1', 'workCenter.workerCount', 40),
    fact('organization', 'organization.additionalContext', 'Private free text'),
  ];
  const changes = assessmentContextChanges(before, after, scopes);
  assert.deepEqual(
    changes.map(({ kind }) => kind),
    ['updated', 'added', 'added'],
  );
  assert.match(changes[0].text, /Colombia/);
  assert.match(changes[1].text, /40/);
  assert.equal(changes[2].text, 'Contexto confirmado');
  assert(changes.every(({ text }) => !/organization\.|workCenter\.|Private/.test(text)));
  assert.deepEqual(
    assessmentContextChanges(
      after,
      after.map((item) => ({ ...item, provenance: { source: 'OTHER' } })),
      scopes,
    ),
    [],
  );
});
test('relay only occurs between distinct work centers using resolved names', () => {
  assert.equal(assessmentCenterRelay('organization', 'center:1', scopes), null);
  assert.equal(assessmentCenterRelay('center:1', 'center:1', scopes), null);
  const relay = assessmentCenterRelay('center:1', 'center:2', scopes);
  assert.equal(relay.from.displayName, 'Oficina');
  assert.equal(relay.to.displayName, 'Remoto');
  assert.equal(relay.toLabel, 'Centro 2');
  assert.equal(relay.total, 2);
});
test('question purpose is visible and scope uses real centers without a disclosure', () => {
  const html = render(AssessmentQuestionCard, {
    question: {
      questionId: 'q',
      factKey: 'workCenter.hasWorkAtHeight',
      scopeKey: 'center:1',
      topic: 'Trabajos críticos',
      questionText: '¿Trabajos en altura?',
      valueType: 'BOOLEAN',
      unknownAllowed: true,
      purpose: 'Comprender la operación.',
      helpText: 'Ayuda',
      choices: [],
      blocking: false,
    },
    disabled: false,
    onAnswer: noop,
    onSkip: noop,
    facts: [],
    scopes,
    saveStatus: createElement(AssessmentSaveStatus, { status: 'idle' }),
  });
  assert.match(html, /Centro 1 de 2/);
  assert.match(html, /Comprender la operación\./);
  assert.doesNotMatch(html, /<details/);
  assert.equal((html.match(/aria-live="polite"/g) ?? []).length, 1);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /checked=""/);
});
test('review excludes commercial optional context and communicates the optional boundary', () => {
  const html = render(AssessmentReview, {
    facts: [],
    scopes,
    busy: false,
    hasOptionalContext: true,
    optionalQuestions: [
      { topic: 'Implementación', collectionPolicy: 'COMMERCIAL_OPTIONAL' },
      { topic: 'Prioridades', collectionPolicy: 'CONTEXT_RECOMMENDED' },
    ],
    onConfirm: noop,
    onEdit: noop,
    onAddOptionalContext: noop,
  });
  assert.match(html, /Listo para diagnóstico/);
  assert.match(html, /Contexto que puede profundizarse/);
  assert.doesNotMatch(html, /Implementación/);
});

test('processing answer stays human and never invents false or zero from a missing value', () => {
  const base = {
    factKey: 'workCenter.workArrangement',
    scopeKey: 'center:1',
    answerState: 'KNOWN',
  };
  assert.equal(assessmentProcessingAnswer({ ...base, value: 'PHYSICAL' }), 'Presencial');
  assert.equal(assessmentProcessingAnswer({ ...base, value: false }), 'No');
  assert.equal(assessmentProcessingAnswer({ ...base, value: 24 }), '24');
  assert.equal(assessmentProcessingAnswer(base), undefined);
  assert.equal(
    assessmentProcessingAnswer({ ...base, answerState: 'EXPLICIT_UNKNOWN' }),
    'No lo sé',
  );
  assert.equal(
    assessmentProcessingAnswer({
      ...base,
      factKey: 'organization.additionalContext',
      value: 'sensitive synthetic context',
    }),
    'Contexto escrito',
  );
});

test('visible purpose keeps human copy and substitutes canonical catalog copy for specialist internals', async () => {
  const { assessmentQuestionPurpose } = await import('../lib/sst-assessment-presentation.ts');
  const base = { factKey: 'workCenter.workArrangement', helpText: 'Ayuda visible' };
  assert.equal(
    assessmentQuestionPurpose({ ...base, purpose: 'Comprender cómo funciona este centro.' }),
    'Comprender cómo funciona este centro.',
  );
  for (const purpose of [
    'Ayuda a resolver centros dentro de esta propuesta DEMO.',
    'Evaluación del pack seleccionado.',
    'workCenter.workerCount >= 20 && ruleKey=DEMO_X',
  ]) {
    const human = assessmentQuestionPurpose({ ...base, purpose });
    assert.match(human, /contexto/);
    assert.doesNotMatch(human, /DEMO|pack|ruleKey|workCenter\.|>=|&&/);
  }
});
