'use client';

import { ApiClientError, apiRequest } from '@sst/api-client';
import { SST_ASSESSMENT_WORK_CENTER_LIMIT } from '@sst/contracts/sst-assessment-catalog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import {
  clearPublicAssessmentSession,
  loadPublicAssessmentSession,
  storePublicAssessmentSession,
  type AssessmentSessionRecord,
} from '@/lib/sst-assessment-session-storage';
import { createPublicAssessmentTransport } from '@/lib/sst-assessment-transport';
import type { AssessmentSession } from '@/lib/sst-assessment-types';
import { GuidedSstAssessmentExperience } from './guided-assessment-experience';
import { AssessmentShell, AssessmentSkeleton } from './assessment-shell';

type CreatedPublicSession = AssessmentSession & { publicToken: string };

function withoutPublicToken(created: CreatedPublicSession): AssessmentSession {
  const { publicToken, ...session } = created;
  if (!publicToken) throw new Error('SST_ASSESSMENT_PUBLIC_TOKEN_MISSING');
  return session;
}

export function PublicAssessmentEntry({
  continuation,
}: {
  continuation: 'public' | 'authenticated';
}) {
  const queryClient = useQueryClient();
  const [record, setRecord] = useState<AssessmentSessionRecord | null | undefined>(undefined);
  const [workCenterCount, setWorkCenterCount] = useState<number | null>(null);
  const [customScope, setCustomScope] = useState(false);
  const [scopeError, setScopeError] = useState('');
  const [persistenceAvailable, setPersistenceAvailable] = useState(false);

  useEffect(() => {
    const stored = loadPublicAssessmentSession(window.localStorage);
    setRecord(stored);
    setPersistenceAvailable(Boolean(stored));
  }, []);
  const transport = useMemo(
    () => (record ? createPublicAssessmentTransport(record.sessionId, record.publicToken) : null),
    [record],
  );
  const session = useQuery({
    queryKey: queryKeys.public.sstAssessment.session(record?.sessionId ?? 'inactive'),
    queryFn: () => transport!.get(),
    enabled: Boolean(transport),
    retry: false,
  });
  const create = useMutation({
    mutationFn: async (count: number) =>
      apiRequest<CreatedPublicSession>('/sst-assessment/public/sessions', {
        method: 'POST',
        body: JSON.stringify({ workCenterCount: count }),
      }),
    onSuccess: (created) => {
      const nextRecord: AssessmentSessionRecord = {
        version: 1,
        sessionId: created.id,
        publicToken: created.publicToken,
        expiresAt: created.expiresAt,
      };
      const stored = storePublicAssessmentSession(window.localStorage, nextRecord);
      setPersistenceAvailable(stored);
      if (!stored) {
        setScopeError(
          'El navegador no permitió guardar la sesión. Puedes continuar, pero no se recuperará al cerrar esta pestaña.',
        );
      }
      queryClient.setQueryData(
        queryKeys.public.sstAssessment.session(created.id),
        withoutPublicToken(created),
      );
      setRecord(nextRecord);
    },
  });

  function begin() {
    if (
      !workCenterCount ||
      workCenterCount < 1 ||
      workCenterCount > SST_ASSESSMENT_WORK_CENTER_LIMIT
    ) {
      setScopeError(`Indica entre 1 y ${SST_ASSESSMENT_WORK_CENTER_LIMIT} centros de trabajo.`);
      return;
    }
    setScopeError('');
    create.mutate(workCenterCount);
  }

  function restart() {
    if (record) clearPublicAssessmentSession(window.localStorage, record.sessionId);
    if (record)
      queryClient.removeQueries({
        queryKey: queryKeys.public.sstAssessment.session(record.sessionId),
      });
    setRecord(null);
    setWorkCenterCount(null);
    setCustomScope(false);
  }

  if (record === undefined) return <AssessmentSkeleton />;
  if (record && session.isLoading) return <AssessmentSkeleton />;
  if (record && session.isError) {
    const terminal =
      session.error instanceof ApiClientError &&
      ['SST_ASSESSMENT_TOKEN_INVALID', 'SST_ASSESSMENT_EXPIRED'].includes(
        session.error.payload.code,
      );
    if (terminal) clearPublicAssessmentSession(window.localStorage, record.sessionId);
    return (
      <AssessmentShell
        title="No pudimos recuperar esta evaluación"
        description="Puedes iniciar una nueva sin exponer información técnica de la sesión."
      >
        <button className="button" type="button" onClick={restart}>
          Iniciar una nueva evaluación
        </button>
      </AssessmentShell>
    );
  }
  if (record && session.data && transport) {
    return (
      <GuidedSstAssessmentExperience
        session={session.data}
        transport={transport}
        continuation={continuation}
        publicPersistenceAvailable={persistenceAvailable}
        onSessionChange={(next) =>
          queryClient.setQueryData(queryKeys.public.sstAssessment.session(record.sessionId), next)
        }
      />
    );
  }

  return (
    <AssessmentShell
      eyebrow="Evaluación SST · Alcance inicial"
      title="Entendamos tu operación antes de configurar"
      description="Incluye las sedes que quieres comprender en este diagnóstico: una oficina, planta, bodega, obra u otro lugar con operación propia."
    >
      <div className="assessment-entry-routes">
        <section
          className="assessment-entry-route assessment-entry-route--recommended"
          aria-labelledby="assessment-guided-route-title"
        >
          <span className="status-badge">Recomendado</span>
          <h2 id="assessment-guided-route-title">Evaluación guiada</h2>
          <p>
            Una decisión por vez, con su motivo a la vista. Construiremos el contexto de tu empresa
            y de cada centro para preparar un diagnóstico orientativo.
          </p>
          <ul>
            <li>Tus respuestas se guardan antes de avanzar.</li>
            <li>Puedes revisar y corregir el contexto confirmado.</li>
            <li>El diagnóstico incluye el fundamento de cada resultado.</li>
          </ul>
          <h3>¿Cuántos centros de trabajo quieres evaluar ahora?</h3>
          <div
            className="assessment-scope-picker"
            role="group"
            aria-label="Cantidad de centros de trabajo"
          >
            {[1, 2, 3].map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={workCenterCount === count}
                onClick={() => {
                  setCustomScope(false);
                  setWorkCenterCount(count);
                }}
              >
                {count}
                <span>{count === 1 ? 'centro' : 'centros'}</span>
              </button>
            ))}
            <button
              type="button"
              aria-pressed={customScope}
              onClick={() => {
                setCustomScope(true);
                setWorkCenterCount(4);
              }}
            >
              4+<span>centros</span>
            </button>
          </div>
          {customScope ? (
            <div className="field assessment-scope-custom">
              <label htmlFor="assessment-center-count">Cantidad exacta</label>
              <input
                id="assessment-center-count"
                type="number"
                step={1}
                min={1}
                max={SST_ASSESSMENT_WORK_CENTER_LIMIT}
                inputMode="numeric"
                value={workCenterCount ?? ''}
                onChange={(event) => setWorkCenterCount(Number(event.target.value))}
              />
            </div>
          ) : null}
          {workCenterCount ? (
            <p className="assessment-scope-selection" role="status">
              {workCenterCount} {workCenterCount === 1 ? 'centro incluido' : 'centros incluidos'} en
              esta evaluación.
            </p>
          ) : null}
          {scopeError ? (
            <p className="field-error" role="alert">
              {scopeError}
            </p>
          ) : null}
          {create.isError ? (
            <p className="field-error" role="alert">
              No pudimos iniciar la evaluación. Intenta nuevamente.
            </p>
          ) : null}
          <button
            className="button assessment-primary-action"
            type="button"
            disabled={create.isPending || workCenterCount === null}
            onClick={begin}
          >
            {create.isPending ? 'Preparando entrevista…' : 'Comenzar evaluación'}
          </button>
          <p className="assessment-context__note">
            Incluye una oficina, planta, bodega, obra u otra sede con operación propia. Podrás
            reiniciar si necesitas cambiar el alcance.
          </p>
        </section>
        <section className="assessment-entry-route" aria-labelledby="assessment-base-route-title">
          <p className="eyebrow">A tu ritmo</p>
          <h2 id="assessment-base-route-title">Entrar al espacio y configurar después</h2>
          <p>
            Puedes entrar al espacio de trabajo sin completar ahora la evaluación. No crearemos
            respuestas, diagnóstico ni recomendaciones con información que no hayas confirmado.
          </p>
          <ul>
            <li>Crea tu acceso y prepara tu empresa.</li>
            <li>Completa la evaluación cuando tengas la información a mano.</li>
          </ul>
          <Link
            className="button secondary assessment-base-setup"
            href={`/auth/register?next=${encodeURIComponent('/app/organizations?setup=base')}`}
          >
            Prefiero empezar y configurar después
          </Link>
          <p className="assessment-context__note">
            La Evaluación SST seguirá disponible para completarla después.
          </p>
        </section>
      </div>
    </AssessmentShell>
  );
}
