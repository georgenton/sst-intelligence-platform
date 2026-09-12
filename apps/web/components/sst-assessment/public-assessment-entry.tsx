'use client';

import { ApiClientError, apiRequest } from '@sst/api-client';
import { SST_ASSESSMENT_WORK_CENTER_LIMIT } from '@sst/contracts/sst-assessment-catalog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  useEffect(() => setRecord(loadPublicAssessmentSession(window.localStorage)), []);
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
      if (!storePublicAssessmentSession(window.localStorage, nextRecord)) {
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
        onSessionChange={(next) =>
          queryClient.setQueryData(queryKeys.public.sstAssessment.session(record.sessionId), next)
        }
      />
    );
  }

  return (
    <AssessmentShell
      eyebrow="Evaluación SST · Alcance inicial"
      title="¿Cuántos centros de trabajo quieres incluir?"
      description="Puede ser una oficina, planta, bodega, obra u otra sede con operación propia. Definiremos este alcance antes de iniciar."
      aside={
        <div className="assessment-scope-note">
          <strong>Tu decisión define la evaluación</strong>
          <p>
            Después de comenzar no cambiaremos silenciosamente la cantidad de centros. Si necesitas
            corregirla, podrás reiniciar.
          </p>
        </div>
      }
    >
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
            inputMode="numeric"
            value={workCenterCount ?? ''}
            onChange={(event) => setWorkCenterCount(Number(event.target.value))}
          />
        </div>
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
    </AssessmentShell>
  );
}
