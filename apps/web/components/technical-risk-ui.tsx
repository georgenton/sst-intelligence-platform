'use client';

import { Card, StatusBadge } from '@sst/ui';
import type { TechnicalMethodSchema, TechnicalQuestion } from '@sst/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';

type Method = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  version: string;
  regulatory: boolean;
  isDemo: boolean;
  disclaimer: string | null;
  schema: TechnicalMethodSchema;
};
type WorkCenter = {
  id: string;
  name: string;
  city?: string;
  workAreas: Array<{ id: string; name: string }>;
};
type Response = { id: string; questionKey: string; value: unknown; updatedAt: string };
type Result = {
  score: number | null;
  level: string | null;
  calculatedAt: string;
  methodKey: string;
  methodVersion: string;
};
type Assessment = {
  id: string;
  title: string;
  description?: string;
  status: string;
  methodKey: string;
  methodVersion: string;
  calculationKey: string;
  methodSnapshot: {
    methodName: string;
    regulatory: boolean;
    isDemo: boolean;
    disclaimer: string | null;
    schema: Method['schema'];
  };
  isDemo: boolean;
  createdAt: string;
  completedAt?: string;
  reviewedAt?: string;
  workCenter: { id: string; name: string; city?: string };
  workArea?: { id: string; name: string };
  createdBy: { id: string; displayName: string; email: string };
  reviewedBy?: { id: string; displayName: string };
  responses?: Response[];
  result?: Result;
  evidence?: Array<{
    id: string;
    type: string;
    questionKey?: string;
    note?: string;
    externalUrl?: string;
    createdBy: { displayName: string };
  }>;
  reviews?: Array<{
    id: string;
    decision: string;
    comment?: string;
    createdAt: string;
    reviewer: { displayName: string };
  }>;
};
type Analytics = {
  total: number;
  draft: number;
  completed: number;
  reviewed: number;
  highCritical: number;
  byMethod: Array<{ methodKey: string; count: number }>;
  byCenter: Array<{ name: string; count: number }>;
  byRiskLevel: Array<{ level: string | null; count: number }>;
};
type ListResponse = { items: Assessment[]; analytics: Analytics };

const labels: Record<string, string> = {
  DRAFT: 'Borrador',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  REVIEWED: 'Revisada',
  CANCELED: 'Cancelada',
  LOW: 'Bajo',
  MODERATE: 'Moderado',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
  APPROVED: 'Revisión aprobada',
  NEEDS_REVISION: 'Revisión solicitada',
};
const label = (value: string | null | undefined) =>
  value ? (labels[value] ?? value.replaceAll('_', ' ')) : 'Sin resultado';

function useApi() {
  const auth = useAuth();
  const organization = useOrganization();
  return {
    organizationId: organization.activeId,
    organization,
    request: <T,>(path: string, init: RequestInit = {}) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

function DemoNotice() {
  return (
    <div className="method-notice" role="note">
      <strong>Metodología demostrativa</strong>
      <span>No constituye una evaluación regulatoria validada.</span>
    </div>
  );
}

function TechnicalQuestionInput({
  question,
  value,
  onChange,
}: {
  question: TechnicalQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `technical-question-${question.key}`;
  const common = { id, name: question.key, required: question.required };
  let input: React.ReactNode;

  switch (question.type) {
    case 'BOOLEAN':
      input = (
        <select
          {...common}
          value={value === undefined ? '' : value === true ? 'true' : 'false'}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : event.target.value === 'true')
          }
        >
          <option value="">Selecciona una opción</option>
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      );
      break;
    case 'SINGLE_CHOICE':
      input = (
        <select
          {...common}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        >
          <option value="">Selecciona una opción</option>
          {question.options.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'INTEGER':
    case 'DECIMAL':
      input = (
        <input
          {...common}
          type="number"
          step={question.type === 'INTEGER' ? 1 : 'any'}
          min={question.min}
          max={question.max}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
        />
      );
      break;
    case 'TEXT':
      input = (
        <textarea
          {...common}
          rows={4}
          maxLength={question.maxLength}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      );
      break;
    case 'LIKELIHOOD':
    case 'CONSEQUENCE':
      input = (
        <select
          {...common}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) =>
            onChange(event.target.value === '' ? undefined : Number(event.target.value))
          }
        >
          <option value="">Selecciona un valor</option>
          {Array.from(
            { length: question.max - question.min + 1 },
            (_, index) => question.min + index,
          ).map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;
  }

  return (
    <div>
      <label htmlFor={id}>
        {question.label}
        {!question.required && ' (opcional)'}
      </label>
      {question.description && <p className="muted">{question.description}</p>}
      {input}
    </div>
  );
}

function Intro({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="inspection-heading">
      <div>
        <p className="eyebrow">Riesgo técnico</p>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      {actions && <div className="form-actions compact">{actions}</div>}
    </div>
  );
}

function RiskBadge({ level }: { level: string | null | undefined }) {
  return (
    <span className={`risk-badge risk-${(level ?? 'none').toLowerCase()}`}>
      Riesgo {label(level)}
    </span>
  );
}

export function TechnicalRiskDashboard() {
  const api = useApi();
  const query = useQuery({
    queryKey: ['technical-risk-assessments', api.organizationId],
    queryFn: () => api.request<ListResponse>('/technical-risk/assessments'),
    enabled: Boolean(api.organizationId),
  });
  if (!api.organizationId) return <Card>Selecciona una organización.</Card>;
  if (query.isLoading) return <p>Cargando evaluaciones técnicas…</p>;
  if (query.isError)
    return <Card>No fue posible cargar Riesgo Técnico. Verifica el acceso del módulo.</Card>;
  const { items, analytics } = query.data!;
  return (
    <div className="stack-lg">
      <Intro
        title="Evaluaciones técnicas"
        description="Métodos versionados, resultados determinísticos y revisión profesional trazable."
        actions={
          <Link className="button" href="/app/technical-risk/new">
            Nueva evaluación
          </Link>
        }
      />
      <div className="metric-grid" aria-label="Indicadores de riesgo técnico">
        {[
          ['Evaluaciones', analytics.total],
          ['Borradores', analytics.draft],
          ['Completadas', analytics.completed],
          ['Revisadas', analytics.reviewed],
          ['Altas o críticas', analytics.highCritical],
        ].map(([name, value]) => (
          <Card key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </Card>
        ))}
      </div>
      <div className="analytics-grid">
        <Card>
          <h3>Por método</h3>
          {analytics.byMethod.map((item) => (
            <div className="data-row" key={item.methodKey}>
              <span>{item.methodKey}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </Card>
        <Card>
          <h3>Por centro</h3>
          {analytics.byCenter.map((item) => (
            <div className="data-row" key={item.name}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </Card>
        <Card>
          <h3>Por nivel</h3>
          {analytics.byRiskLevel.map((item) => (
            <div className="data-row" key={item.level ?? 'none'}>
              <span>{label(item.level)}</span>
              <strong>{item.count}</strong>
            </div>
          ))}
        </Card>
      </div>
      <section>
        <h3>Evaluaciones recientes</h3>
        {items.length === 0 ? (
          <Card>
            <p>Aún no existen evaluaciones.</p>
            <Link href="/app/technical-risk/new">Crear la primera →</Link>
          </Card>
        ) : (
          <div className="adaptive-list">
            {items.map((item) => (
              <Link
                className="inspection-card"
                href={`/app/technical-risk/${item.id}`}
                key={item.id}
              >
                <div>
                  <StatusBadge>{label(item.status)}</StatusBadge>
                  {item.isDemo && <span className="demo-chip">Metodología demo</span>}
                  <h3>{item.title}</h3>
                  <p className="muted">
                    {item.workCenter.name} · {item.methodKey} v{item.methodVersion}
                  </p>
                </div>
                {item.result && <RiskBadge level={item.result.level} />}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type GuidedForm = {
  methodVersionId: string;
  workCenterId: string;
  workAreaId: string;
  title: string;
  description: string;
  evidenceType: 'NOTE' | 'EXTERNAL_LINK';
  evidenceNote: string;
  evidenceUrl: string;
};

export function NewTechnicalAssessment() {
  const api = useApi();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const form = useForm<GuidedForm>({
    defaultValues: {
      workAreaId: '',
      description: '',
      evidenceType: 'NOTE',
      evidenceNote: '',
      evidenceUrl: '',
    },
  });
  const methods = useQuery({
    queryKey: ['technical-risk-methods', api.organizationId],
    queryFn: () => api.request<Method[]>('/technical-risk/methods'),
    enabled: Boolean(api.organizationId),
  });
  const organizationDetails = useQuery({
    queryKey: ['technical-risk-context', api.organizationId],
    queryFn: () =>
      api.request<{ workCenters: WorkCenter[] }>(`/organizations/${api.organizationId}`),
    enabled: Boolean(api.organizationId),
  });
  const selectedMethod = methods.data?.find(({ id }) => id === form.watch('methodVersionId'));
  const selectedCenter = organizationDetails.data?.workCenters.find(
    ({ id }) => id === form.watch('workCenterId'),
  );
  const submit = useMutation({
    mutationFn: async (values: GuidedForm) => {
      const created = await api.request<Assessment>('/technical-risk/assessments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          methodVersionId: values.methodVersionId,
          workCenterId: values.workCenterId,
          workAreaId: values.workAreaId || undefined,
          title: values.title,
          description: values.description || undefined,
        }),
      });
      await api.request(`/technical-risk/assessments/${created.id}/start`, { method: 'POST' });
      const submittedAnswers = Object.fromEntries(
        selectedMethod!.schema.sections
          .flatMap((section) => section.questions)
          .map((question) => [question.key, answers[question.key]] as const)
          .filter(([, value]) => value !== undefined && value !== null && value !== ''),
      );
      for (const [questionKey, value] of Object.entries(submittedAnswers)) {
        await api.request(`/technical-risk/assessments/${created.id}/responses/${questionKey}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ value }),
        });
      }
      const evidenceValue =
        values.evidenceType === 'NOTE' ? values.evidenceNote.trim() : values.evidenceUrl.trim();
      if (evidenceValue) {
        await api.request(`/technical-risk/assessments/${created.id}/evidence`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: values.evidenceType,
            note: values.evidenceType === 'NOTE' ? evidenceValue : undefined,
            externalUrl: values.evidenceType === 'EXTERNAL_LINK' ? evidenceValue : undefined,
          }),
        });
      }
      await api.request(`/technical-risk/assessments/${created.id}/complete`, { method: 'POST' });
      return created.id;
    },
    onSuccess: (id) => router.push(`/app/technical-risk/${id}`),
  });
  if (!api.organizationId) return <Card>Selecciona una organización.</Card>;
  if (methods.isLoading || organizationDetails.isLoading) return <p>Preparando evaluación…</p>;
  if (methods.isError || organizationDetails.isError)
    return <Card>No fue posible preparar el flujo técnico.</Card>;
  const centers = organizationDetails.data!.workCenters;
  const stepTitles = [
    'Método',
    'Ubicación',
    'Contexto',
    'Preguntas técnicas',
    'Resumen previo al cálculo',
  ];
  const methodRegistration = form.register('methodVersionId', { required: true });
  const firstSection = selectedMethod?.schema.sections.slice(0, 1) ?? [];
  const remainingSections = selectedMethod?.schema.sections.slice(1) ?? [];
  const renderSections = (sections: TechnicalMethodSchema['sections']) =>
    sections.map((section) => (
      <section key={section.key}>
        <h3>{section.title}</h3>
        {section.questions.map((question) => (
          <TechnicalQuestionInput
            question={question}
            value={answers[question.key]}
            onChange={(value) => setAnswers((current) => ({ ...current, [question.key]: value }))}
            key={question.key}
          />
        ))}
      </section>
    ));
  return (
    <div className="stack-lg narrow">
      <Intro
        title="Nueva evaluación técnica"
        description="Completa el recorrido guiado. El servidor ejecutará el método seleccionado."
      />
      <div>
        <p className="eyebrow">
          Paso {step} de 5 · {stepTitles[step - 1]}
        </p>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${step * 20}%` }} />
        </div>
      </div>
      <form onSubmit={form.handleSubmit((data) => submit.mutate(data))}>
        {step === 1 && (
          <Card>
            <h3>Selecciona un método</h3>
            <label htmlFor="technical-method">Método técnico</label>
            <select
              id="technical-method"
              {...methodRegistration}
              onChange={(event) => {
                void methodRegistration.onChange(event);
                setAnswers({});
              }}
            >
              <option value="">Selecciona un método</option>
              {methods.data!.map((method) => (
                <option value={method.id} key={method.id}>
                  {method.name} · v{method.version}
                </option>
              ))}
            </select>
            {selectedMethod && (
              <>
                <p>{selectedMethod.description}</p>
                {selectedMethod.isDemo && <DemoNotice />}
              </>
            )}
          </Card>
        )}
        {step === 2 && (
          <Card>
            <h3>Ubicación</h3>
            <label htmlFor="technical-center">Centro de trabajo</label>
            <select id="technical-center" {...form.register('workCenterId', { required: true })}>
              <option value="">Selecciona un centro</option>
              {centers.map((center) => (
                <option value={center.id} key={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
            <label htmlFor="technical-area">Área (opcional)</label>
            <select id="technical-area" {...form.register('workAreaId')}>
              <option value="">Sin área específica</option>
              {selectedCenter?.workAreas.map((area) => (
                <option value={area.id} key={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            <label htmlFor="technical-title">Título</label>
            <input
              id="technical-title"
              {...form.register('title', { required: true, minLength: 3 })}
            />
            <label htmlFor="technical-description">Descripción (opcional)</label>
            <textarea id="technical-description" rows={3} {...form.register('description')} />
          </Card>
        )}
        {step === 3 && (
          <Card>
            {selectedMethod ? renderSections(firstSection) : <p>Selecciona un método.</p>}
          </Card>
        )}
        {step === 4 && (
          <Card>
            {selectedMethod ? renderSections(remainingSections) : <p>Selecciona un método.</p>}
            <h4>Evidencia (opcional)</h4>
            <label htmlFor="guided-evidence-type">Tipo de evidencia</label>
            <select id="guided-evidence-type" {...form.register('evidenceType')}>
              <option value="NOTE">Nota</option>
              <option value="EXTERNAL_LINK">Enlace externo HTTPS</option>
            </select>
            {form.watch('evidenceType') === 'NOTE' ? (
              <>
                <label htmlFor="guided-evidence-note">Nota de evidencia</label>
                <textarea id="guided-evidence-note" rows={3} {...form.register('evidenceNote')} />
              </>
            ) : (
              <>
                <label htmlFor="guided-evidence-url">Enlace externo HTTPS</label>
                <input id="guided-evidence-url" type="url" {...form.register('evidenceUrl')} />
              </>
            )}
          </Card>
        )}
        {step === 5 && (
          <Card>
            <h3>Resumen previo al cálculo</h3>
            <div className="data-row">
              <span>Método</span>
              <strong>{selectedMethod?.name}</strong>
            </div>
            <div className="data-row">
              <span>Versión</span>
              <strong>{selectedMethod?.version}</strong>
            </div>
            <div className="data-row">
              <span>Centro</span>
              <strong>{selectedCenter?.name}</strong>
            </div>
            {selectedMethod?.schema.sections
              .flatMap((section) => section.questions)
              .map((question) => (
                <div className="data-row" key={question.key}>
                  <span>{question.label}</span>
                  <strong>{String(answers[question.key] ?? 'Sin respuesta')}</strong>
                </div>
              ))}
            <p>El resultado será calculado por el sistema según la versión seleccionada.</p>
            {selectedMethod?.isDemo && <DemoNotice />}
          </Card>
        )}
        {submit.isError && (
          <p className="error" role="alert">
            No fue posible completar la evaluación. Revisa los datos e inténtalo nuevamente.
          </p>
        )}
        <div className="form-actions">
          <button
            className="button secondary"
            type="button"
            disabled={step === 1 || submit.isPending}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
          >
            Atrás
          </button>
          {step < 5 ? (
            <button
              className="button"
              type="button"
              onClick={() => setStep((current) => Math.min(5, current + 1))}
            >
              Continuar
            </button>
          ) : (
            <button className="button" type="submit" disabled={submit.isPending}>
              {submit.isPending ? 'Calculando…' : 'Calcular resultado'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function TechnicalAssessmentDetail({ assessmentId }: { assessmentId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const evidenceForm = useForm<{
    type: 'NOTE' | 'EXTERNAL_LINK';
    note: string;
    externalUrl: string;
  }>({ defaultValues: { type: 'NOTE', note: '', externalUrl: '' } });
  const query = useQuery({
    queryKey: ['technical-risk-assessment', api.organizationId, assessmentId],
    queryFn: () => api.request<Assessment>(`/technical-risk/assessments/${assessmentId}`),
    enabled: Boolean(api.organizationId),
  });
  const evidence = useMutation({
    mutationFn: (values: { type: 'NOTE' | 'EXTERNAL_LINK'; note: string; externalUrl: string }) =>
      api.request(`/technical-risk/assessments/${assessmentId}/evidence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: values.type,
          note: values.type === 'NOTE' ? values.note : undefined,
          externalUrl: values.type === 'EXTERNAL_LINK' ? values.externalUrl : undefined,
        }),
      }),
    onSuccess: () => {
      evidenceForm.reset();
      void queryClient.invalidateQueries({
        queryKey: ['technical-risk-assessment', api.organizationId, assessmentId],
      });
    },
  });
  if (query.isLoading) return <p>Cargando evaluación…</p>;
  if (query.isError || !query.data) return <Card>No fue posible cargar la evaluación.</Card>;
  const assessment = query.data;
  return (
    <div className="stack-lg">
      <Intro
        title={assessment.title}
        description={`${assessment.workCenter.name}${assessment.workArea ? ` · ${assessment.workArea.name}` : ''}`}
        actions={
          assessment.status === 'COMPLETED' ? (
            <Link className="button" href={`/app/technical-risk/${assessment.id}/review`}>
              Revisar evaluación
            </Link>
          ) : undefined
        }
      />
      {assessment.isDemo && <DemoNotice />}
      <Card>
        <div className="detail-strip">
          <StatusBadge>{label(assessment.status)}</StatusBadge>
          {assessment.result && <RiskBadge level={assessment.result.level} />}
        </div>
        <h3>Resultado técnico</h3>
        <div className="result-grid">
          <div>
            <span>Método</span>
            <strong>{assessment.methodSnapshot.methodName}</strong>
          </div>
          <div>
            <span>Versión</span>
            <strong>{assessment.methodVersion}</strong>
          </div>
          <div>
            <span>Score</span>
            <strong>{assessment.result?.score ?? 'Pendiente'}</strong>
          </div>
          <div>
            <span>Nivel</span>
            <strong>{label(assessment.result?.level)}</strong>
          </div>
          <div>
            <span>Calculado</span>
            <strong>
              {assessment.result
                ? new Date(assessment.result.calculatedAt).toLocaleString('es')
                : 'Pendiente'}
            </strong>
          </div>
          <div>
            <span>Estado de revisión</span>
            <strong>
              {assessment.status === 'REVIEWED'
                ? 'Revisada por usuario autorizado'
                : 'Pendiente de revisión'}
            </strong>
          </div>
        </div>
      </Card>
      <Card>
        <h3>Respuestas</h3>
        {assessment.responses?.map((response) => (
          <div className="data-row" key={response.id}>
            <span>{questionLabel(assessment, response.questionKey)}</span>
            <strong>{String(response.value)}</strong>
          </div>
        ))}
      </Card>
      <Card>
        <h3>Evidencia estructurada</h3>
        {assessment.evidence?.length ? (
          assessment.evidence.map((item) => (
            <div className="data-row" key={item.id}>
              <span>
                {item.type === 'NOTE' ? (
                  item.note
                ) : (
                  <a href={item.externalUrl} target="_blank" rel="noreferrer">
                    Abrir enlace externo
                  </a>
                )}
              </span>
              <small>{item.createdBy.displayName}</small>
            </div>
          ))
        ) : (
          <p className="muted">Sin evidencia registrada.</p>
        )}
        {['DRAFT', 'IN_PROGRESS'].includes(assessment.status) && (
          <form onSubmit={evidenceForm.handleSubmit((values) => evidence.mutate(values))}>
            <label htmlFor="evidence-type">Tipo de evidencia</label>
            <select id="evidence-type" {...evidenceForm.register('type')}>
              <option value="NOTE">Nota</option>
              <option value="EXTERNAL_LINK">Enlace externo HTTPS</option>
            </select>
            {evidenceForm.watch('type') === 'NOTE' ? (
              <>
                <label htmlFor="evidence-note">Nota</label>
                <textarea
                  id="evidence-note"
                  {...evidenceForm.register('note', { required: true })}
                />
              </>
            ) : (
              <>
                <label htmlFor="evidence-url">Enlace externo</label>
                <input
                  id="evidence-url"
                  type="url"
                  {...evidenceForm.register('externalUrl', { required: true })}
                />
              </>
            )}
            <button className="button" disabled={evidence.isPending}>
              Agregar evidencia
            </button>
          </form>
        )}
      </Card>
      <Card>
        <h3>Revisión profesional</h3>
        {assessment.reviews?.length ? (
          assessment.reviews.map((review) => (
            <div className="review-entry" key={review.id}>
              <strong>{label(review.decision)}</strong>
              <span>
                {review.reviewer.displayName} · {new Date(review.createdAt).toLocaleString('es')}
              </span>
              {review.comment && <p>{review.comment}</p>}
            </div>
          ))
        ) : (
          <p className="muted">Aún no existe una revisión profesional.</p>
        )}
        <p className="muted">
          Una aprobación significa “revisado por usuario autorizado”; no certifica cumplimiento
          legal.
        </p>
      </Card>
    </div>
  );
}

function questionLabel(assessment: Assessment, key: string) {
  return (
    assessment.methodSnapshot.schema.sections
      .flatMap(({ questions }) => questions)
      .find((question) => question.key === key)?.label ?? key
  );
}

export function TechnicalAssessmentReview({ assessmentId }: { assessmentId: string }) {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<{ comment: string }>({ defaultValues: { comment: '' } });
  const query = useQuery({
    queryKey: ['technical-risk-assessment', api.organizationId, assessmentId],
    queryFn: () => api.request<Assessment>(`/technical-risk/assessments/${assessmentId}`),
    enabled: Boolean(api.organizationId),
  });
  const mutation = useMutation({
    mutationFn: (decision: 'APPROVED' | 'NEEDS_REVISION') =>
      api.request(`/technical-risk/assessments/${assessmentId}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, comment: form.getValues('comment') || undefined }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['technical-risk-assessment', api.organizationId, assessmentId],
      });
      router.push(`/app/technical-risk/${assessmentId}`);
    },
  });
  const assessment = query.data;
  const answerMap = useMemo(
    () => new Map(assessment?.responses?.map((item) => [item.questionKey, item.value]) ?? []),
    [assessment],
  );
  if (query.isLoading) return <p>Cargando revisión…</p>;
  if (query.isError || !assessment) return <Card>No fue posible cargar la revisión.</Card>;
  return (
    <div className="stack-lg narrow">
      <Intro
        title="Revisión profesional"
        description="Revisa ubicación, método, respuestas, resultado, evidencia y autor antes de decidir."
      />
      {assessment.isDemo && <DemoNotice />}
      <Card>
        <h3>{assessment.title}</h3>
        <div className="data-row">
          <span>Ubicación</span>
          <strong>
            {assessment.workCenter.name}
            {assessment.workArea ? ` · ${assessment.workArea.name}` : ''}
          </strong>
        </div>
        <div className="data-row">
          <span>Método</span>
          <strong>{assessment.methodSnapshot.methodName}</strong>
        </div>
        <div className="data-row">
          <span>Versión</span>
          <strong>{assessment.methodVersion}</strong>
        </div>
        <div className="data-row">
          <span>Resultado</span>
          <strong>
            {assessment.result?.score} · {label(assessment.result?.level)}
          </strong>
        </div>
        <div className="data-row">
          <span>Creador</span>
          <strong>{assessment.createdBy.displayName}</strong>
        </div>
        <div className="data-row">
          <span>Creada</span>
          <strong>{new Date(assessment.createdAt).toLocaleString('es')}</strong>
        </div>
      </Card>
      <Card>
        <h3>Respuestas</h3>
        {assessment.methodSnapshot.schema.sections
          .flatMap(({ questions }) => questions)
          .map((question) => (
            <div className="data-row" key={question.key}>
              <span>{question.label}</span>
              <strong>{String(answerMap.get(question.key) ?? 'Sin respuesta')}</strong>
            </div>
          ))}
      </Card>
      <Card>
        <h3>Evidencia</h3>
        {assessment.evidence?.length ? (
          assessment.evidence.map((item) => (
            <div className="data-row" key={item.id}>
              <span>{item.type}</span>
              <strong>{item.note ?? item.externalUrl}</strong>
            </div>
          ))
        ) : (
          <p>Sin evidencia.</p>
        )}
      </Card>
      <Card>
        <label htmlFor="review-comment">Comentario (opcional)</label>
        <textarea id="review-comment" rows={4} {...form.register('comment')} />
        <p className="muted">
          Aprobar significa que un usuario autorizado revisó el registro. No certifica cumplimiento
          legal.
        </p>
        <div className="form-actions">
          <button
            className="button secondary"
            disabled={mutation.isPending || assessment.status !== 'COMPLETED'}
            onClick={() => mutation.mutate('NEEDS_REVISION')}
          >
            Solicitar revisión
          </button>
          <button
            className="button"
            disabled={mutation.isPending || assessment.status !== 'COMPLETED'}
            onClick={() => mutation.mutate('APPROVED')}
          >
            Aprobar revisión
          </button>
        </div>
        {mutation.isError && (
          <p className="error" role="alert">
            Tu rol o el estado actual no permiten completar la revisión.
          </p>
        )}
      </Card>
    </div>
  );
}
