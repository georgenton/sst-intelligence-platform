'use client';

import { apiRequest } from '@sst/api-client';
import type { SolutionAnswers } from '@sst/contracts';
import { Button } from '@sst/ui';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  GuidedFlow,
  GuidedQuestion,
  GuidedStep,
  ProgressIndicator,
  SessionPersistence,
} from './guided';

const defaults: SolutionAnswers = {
  country: 'Ecuador',
  sector: 'Servicios',
  workerRange: '11_50',
  workCenters: 1,
  criticalActivities: false,
  workAtHeight: false,
  hotWork: false,
  electricity: false,
  chemicals: false,
  drivers: false,
  fireRisk: false,
  criticalAssets: false,
  contractors: false,
  managementSystem: 'SPREADSHEETS',
  inspectionFrequency: 'MONTHLY',
  manualPermits: false,
  evidenceDifficulty: false,
  overdueActions: false,
  recurringFindings: false,
  psychosocialEvaluation: false,
  multipleShifts: false,
  stressExposedRoles: false,
  organizationalCampaigns: false,
  objectives: ['COMPLIANCE'],
  urgency: 'MEDIUM',
  estimatedUsers: 5,
  rolloutPreference: 'GRADUAL',
};

const booleanFields: Array<[keyof SolutionAnswers, string]> = [
  ['criticalActivities', 'Actividades críticas'],
  ['workAtHeight', 'Trabajo en altura'],
  ['hotWork', 'Trabajo en caliente'],
  ['electricity', 'Electricidad'],
  ['chemicals', 'Sustancias químicas'],
  ['drivers', 'Transporte o conductores'],
  ['fireRisk', 'Riesgo de incendio'],
  ['criticalAssets', 'Activos críticos'],
  ['contractors', 'Contratistas'],
];

export function SolutionFlow() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const {
    register,
    getValues,
    reset,
    formState: { isSubmitting },
  } = useForm<SolutionAnswers>({ defaultValues: defaults });

  useEffect(() => {
    const token = SessionPersistence.load(sessionId);
    if (!token) {
      setError('No encontramos el token para reanudar esta sesión.');
      setLoading(false);
      return;
    }
    apiRequest<{ answers: Partial<SolutionAnswers>; currentStep: number }>(
      `/solution-finder/sessions/${sessionId}`,
      {},
      { sessionToken: token },
    )
      .then((session) => {
        reset({ ...defaults, ...session.answers });
        setStep(session.currentStep);
      })
      .catch(() => setError('No pudimos reanudar esta sesión.'))
      .finally(() => setLoading(false));
  }, [reset, sessionId]);

  async function persist(nextStep: number) {
    const token = SessionPersistence.load(sessionId);
    if (!token) throw new Error('SESSION_TOKEN_MISSING');
    const values = getValues();
    const answers = { ...values, budgetRange: values.budgetRange || undefined };
    await apiRequest(
      `/solution-finder/sessions/${sessionId}`,
      { method: 'PATCH', body: JSON.stringify({ answers, currentStep: nextStep }) },
      { sessionToken: token },
    );
  }

  async function next() {
    setError('');
    try {
      const nextStep = Math.min(6, step + 1);
      await persist(nextStep);
      if (step < 6) setStep(nextStep);
      else {
        const token = SessionPersistence.load(sessionId)!;
        await apiRequest(
          `/solution-finder/sessions/${sessionId}/complete`,
          { method: 'POST' },
          { sessionToken: token },
        );
        router.push(`/diagnostico/${sessionId}/resultado`);
      }
    } catch {
      setError('No pudimos guardar el progreso. Revisa los campos e intenta nuevamente.');
    }
  }

  if (loading) return <p>Cargando diagnóstico…</p>;
  return (
    <GuidedFlow>
      <ProgressIndicator step={step} total={6} />
      {step === 1 && (
        <GuidedStep
          title="Tu empresa"
          description="Dimensionemos la operación sin pedir información sensible."
        >
          <div className="grid">
            <div className="field">
              <label htmlFor="country">País</label>
              <input id="country" required {...register('country', { required: true })} />
            </div>
            <div className="field">
              <label htmlFor="sector">Sector</label>
              <input id="sector" required {...register('sector', { required: true })} />
            </div>
            <div className="field">
              <label htmlFor="workerRange">Trabajadores</label>
              <select id="workerRange" {...register('workerRange')}>
                <option value="1_10">1 a 10</option>
                <option value="11_50">11 a 50</option>
                <option value="51_200">51 a 200</option>
                <option value="201_1000">201 a 1.000</option>
                <option value="MORE_1000">Más de 1.000</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="workCenters">Centros de trabajo</label>
              <input
                id="workCenters"
                type="number"
                min="1"
                max="500"
                {...register('workCenters', { valueAsNumber: true })}
              />
            </div>
          </div>
        </GuidedStep>
      )}
      {step === 2 && (
        <GuidedStep
          title="Operación"
          description="Marca las condiciones presentes en tu operación."
        >
          <GuidedQuestion legend="Actividades y exposiciones">
            <div className="checkbox-grid">
              {booleanFields.map(([name, label]) => (
                <label className="check" key={name}>
                  <input type="checkbox" {...register(name)} />
                  {label}
                </label>
              ))}
            </div>
          </GuidedQuestion>
        </GuidedStep>
      )}
      {step === 3 && (
        <GuidedStep
          title="Gestión actual"
          description="Cuéntanos cómo administras hoy evidencias y acciones."
        >
          <div className="grid">
            <div className="field">
              <label htmlFor="managementSystem">Medio principal</label>
              <select id="managementSystem" {...register('managementSystem')}>
                <option value="PAPER">Papel</option>
                <option value="SPREADSHEETS">Hojas de cálculo</option>
                <option value="SOFTWARE">Software existente</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="inspectionFrequency">Frecuencia de inspecciones</label>
              <select id="inspectionFrequency" {...register('inspectionFrequency')}>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensual</option>
                <option value="QUARTERLY">Trimestral</option>
                <option value="RARELY">Ocasional</option>
              </select>
            </div>
          </div>
          <div className="checkbox-grid">
            {(
              [
                ['manualPermits', 'Permisos manuales'],
                ['evidenceDifficulty', 'Dificultad para encontrar evidencias'],
                ['overdueActions', 'Acciones vencidas'],
                ['recurringFindings', 'Hallazgos recurrentes'],
              ] as const
            ).map(([name, label]) => (
              <label className="check" key={name}>
                <input type="checkbox" {...register(name)} />
                {label}
              </label>
            ))}
          </div>
        </GuidedStep>
      )}
      {step === 4 && (
        <GuidedStep
          title="Personas y organización"
          description="Solo necesidades organizacionales agregadas; no solicitamos datos personales."
        >
          <div className="checkbox-grid">
            {(
              [
                ['psychosocialEvaluation', 'Necesidad de evaluar factores psicosociales'],
                ['multipleShifts', 'Múltiples turnos'],
                ['stressExposedRoles', 'Cargos expuestos a estrés'],
                ['organizationalCampaigns', 'Campañas o seguimiento organizacional'],
              ] as const
            ).map(([name, label]) => (
              <label className="check" key={name}>
                <input type="checkbox" {...register(name)} />
                {label}
              </label>
            ))}
          </div>
        </GuidedStep>
      )}
      {step === 5 && (
        <GuidedStep title="Objetivos" description="Selecciona lo que esperas mejorar.">
          <GuidedQuestion legend="Objetivos prioritarios">
            <div className="checkbox-grid">
              {(
                [
                  ['COMPLIANCE', 'Cumplimiento'],
                  ['CENTRALIZATION', 'Centralización'],
                  ['AUTOMATION', 'Automatización'],
                  ['TRACKING', 'Seguimiento'],
                  ['REWORK_REDUCTION', 'Reducir reprocesos'],
                  ['RECURRENCE_ANALYSIS', 'Analizar recurrencias'],
                  ['REPORTING', 'Reportería'],
                ] as const
              ).map(([value, label]) => (
                <label className="check" key={value}>
                  <input type="checkbox" value={value} {...register('objectives')} />
                  {label}
                </label>
              ))}
            </div>
          </GuidedQuestion>
        </GuidedStep>
      )}
      {step === 6 && (
        <GuidedStep
          title="Implementación"
          description="El presupuesto solo ordena el despliegue; nunca elimina una necesidad técnica detectada."
        >
          <div className="grid">
            <div className="field">
              <label htmlFor="urgency">Urgencia</label>
              <select id="urgency" {...register('urgency')}>
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="estimatedUsers">Usuarios estimados</label>
              <input
                id="estimatedUsers"
                type="number"
                min="1"
                {...register('estimatedUsers', { valueAsNumber: true })}
              />
            </div>
            <div className="field">
              <label htmlFor="budgetRange">Presupuesto aproximado (opcional)</label>
              <select id="budgetRange" {...register('budgetRange')}>
                <option value="">Prefiero no indicarlo</option>
                <option value="LOW">Acotado</option>
                <option value="MEDIUM">Intermedio</option>
                <option value="HIGH">Amplio</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="rolloutPreference">Preferencia</label>
              <select id="rolloutPreference" {...register('rolloutPreference')}>
                <option value="GRADUAL">Gradual</option>
                <option value="INTEGRAL">Integral</option>
              </select>
            </div>
          </div>
        </GuidedStep>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button
          className="secondary"
          type="button"
          disabled={step === 1 || isSubmitting}
          onClick={() => setStep((value) => Math.max(1, value - 1))}
        >
          Anterior
        </Button>
        <Button type="button" disabled={isSubmitting} onClick={next}>
          {step === 6 ? 'Ver recomendación' : 'Guardar y continuar'}
        </Button>
      </div>
    </GuidedFlow>
  );
}
