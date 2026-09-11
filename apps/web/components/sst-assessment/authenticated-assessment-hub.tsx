'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { assessmentErrorMessage } from '@/lib/sst-assessment-presentation';
import { createAuthenticatedAssessmentTransport } from '@/lib/sst-assessment-transport';
import type {
  AssessmentHistoryItem,
  AssessmentSession,
  AssessmentSetupState,
} from '@/lib/sst-assessment-types';
import { useAuth } from '../auth-provider';
import { useOrganization } from '../app-shell';
import { GuidedSstAssessmentExperience } from './guided-assessment-experience';
import { AssessmentShell, AssessmentSkeleton } from './assessment-shell';

type OrganizationDetails = {
  id: string;
  name: string;
  country: string;
  sector?: string;
  workCenters: WorkCenter[];
};
type WorkCenter = { id: string; name: string; city?: string; isActive: boolean };

function EditableCenterRow({
  center,
  disabled,
  onSave,
}: {
  center: WorkCenter;
  disabled: boolean;
  onSave(center: WorkCenter): void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(center.name);
  const [city, setCity] = useState(center.city ?? '');
  if (!editing)
    return (
      <div>
        <strong>{center.name}</strong>
        <span>{center.city || 'Ciudad no indicada'}</span>
        <button type="button" onClick={() => setEditing(true)}>
          Configurar
        </button>
      </div>
    );
  return (
    <div className="assessment-inline-form">
      <label>
        <span>Nombre</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        <span>Ciudad · opcional</span>
        <input value={city} onChange={(event) => setCity(event.target.value)} />
      </label>
      <button
        type="button"
        disabled={disabled || name.trim().length < 2}
        onClick={() => {
          onSave({ ...center, name, city });
          setEditing(false);
        }}
      >
        Guardar
      </button>
      <button type="button" onClick={() => setEditing(false)}>
        Cancelar
      </button>
    </div>
  );
}

export function AuthenticatedAssessmentHub({ sessionId: routeSessionId }: { sessionId?: string }) {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const [selectedSessionId, setSelectedSessionId] = useState(routeSessionId ?? null);
  const [sector, setSector] = useState('');
  const [newCenterName, setNewCenterName] = useState('');
  const [newCenterCity, setNewCenterCity] = useState('');
  const [message, setMessage] = useState('');
  const canConfigureCompany =
    organization.currentRole === 'ORG_OWNER' || organization.currentRole === 'ORG_ADMIN';

  const setup = useQuery({
    queryKey: queryKeys.organization.sstAssessmentSetup(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<AssessmentSetupState>(
        '/sst-assessment/setup-state',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const details = useQuery({
    queryKey: queryKeys.organization.details(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<OrganizationDetails>(
        `/organizations/${organizationId}`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const centers = useQuery({
    queryKey: queryKeys.organization.workCenters(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<WorkCenter[]>(
        `/organizations/${organizationId}/work-centers`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const history = useQuery({
    queryKey: queryKeys.organization.sstAssessmentHistory(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<AssessmentHistoryItem[]>(
        '/sst-assessment/sessions',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const effectiveSessionId =
    selectedSessionId ?? routeSessionId ?? setup.data?.assessmentId ?? null;
  const transport = useMemo(
    () =>
      organizationId && effectiveSessionId
        ? createAuthenticatedAssessmentTransport(auth.request, organizationId, effectiveSessionId)
        : null,
    [auth.request, effectiveSessionId, organizationId],
  );
  const session = useQuery({
    queryKey: queryKeys.organization.sstAssessmentSession(
      organizationId ?? 'inactive',
      effectiveSessionId ?? 'none',
    ),
    queryFn: () => transport!.get(),
    enabled: Boolean(transport),
    retry: false,
  });

  async function refreshSetup() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.sstAssessmentSetup(organizationId!),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.sstAssessmentHistory(organizationId!),
      }),
    ]);
  }

  const createAssessment = useMutation({
    mutationFn: (
      input: { kind?: 'INITIAL_ASSESSMENT' | 'REASSESSMENT'; parentAssessmentId?: string } = {},
    ) =>
      auth.request<AssessmentSession>(
        '/sst-assessment/sessions',
        { method: 'POST', body: JSON.stringify(input) },
        organizationId!,
      ),
    onSuccess: async (created) => {
      queryClient.setQueryData(
        queryKeys.organization.sstAssessmentSession(organizationId!, created.id),
        created,
      );
      setSelectedSessionId(created.id);
      await refreshSetup();
    },
  });
  const saveSector = useMutation({
    mutationFn: () =>
      auth.request(
        `/organizations/${organizationId}`,
        { method: 'PATCH', body: JSON.stringify({ sector }) },
        organizationId!,
      ),
    onSuccess: async () => {
      setMessage('Actividad principal guardada.');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.details(organizationId!),
      });
    },
  });
  const updateCenter = useMutation({
    mutationFn: (center: WorkCenter) =>
      auth.request(
        `/organizations/${organizationId}/work-centers/${center.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: center.name,
            city: center.city || undefined,
            isActive: center.isActive,
          }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      setMessage('Centro de trabajo actualizado.');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.workCenters(organizationId!),
      });
    },
  });
  const addCenter = useMutation({
    mutationFn: () =>
      auth.request<WorkCenter>(
        `/organizations/${organizationId}/work-centers`,
        {
          method: 'POST',
          body: JSON.stringify({ name: newCenterName, city: newCenterCity || undefined }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      setNewCenterName('');
      setNewCenterCity('');
      setMessage('Centro de trabajo agregado antes de iniciar la evaluación.');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organization.workCenters(organizationId!),
      });
    },
  });

  if (!organizationId)
    return (
      <AssessmentShell
        title="Selecciona una empresa"
        description="La evaluación autenticada siempre usa un contexto de empresa validado."
      />
    );
  if (setup.isLoading || details.isLoading || centers.isLoading || history.isLoading)
    return <AssessmentSkeleton />;
  if (setup.isError || details.isError || centers.isError)
    return (
      <AssessmentShell
        title="No pudimos preparar la evaluación"
        description="No montamos herramientas privadas mientras el estado de configuración no sea verificable."
      >
        <button className="button" type="button" onClick={() => void setup.refetch()}>
          Reintentar
        </button>
      </AssessmentShell>
    );
  if (effectiveSessionId && session.isLoading) return <AssessmentSkeleton />;
  if (effectiveSessionId && session.isError)
    return (
      <AssessmentShell
        title="No pudimos recuperar la evaluación"
        description="El estado confirmado permanece en el servidor. Puedes reintentar sin perder respuestas."
      >
        <button className="button" type="button" onClick={() => void session.refetch()}>
          Reintentar
        </button>
      </AssessmentShell>
    );
  if (transport && session.data) {
    return (
      <>
        <GuidedSstAssessmentExperience
          session={session.data}
          transport={transport}
          onSessionChange={(next) => {
            queryClient.setQueryData(
              queryKeys.organization.sstAssessmentSession(organizationId, next.id),
              next,
            );
            if (next.status === 'FINALIZED') void refreshSetup();
          }}
          onReassess={() =>
            createAssessment.mutate({ kind: 'REASSESSMENT', parentAssessmentId: session.data.id })
          }
        />
        {session.data.status === 'FINALIZED' && history.data?.length ? (
          <section
            className="assessment-history assessment-history--results"
            aria-labelledby="assessment-history-title"
          >
            <h2 id="assessment-history-title">Historial de evaluaciones</h2>
            <p>Cada diagnóstico conserva su propio contexto confirmado.</p>
            {history.data.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-current={item.id === session.data.id ? 'true' : undefined}
                onClick={() => setSelectedSessionId(item.id)}
              >
                <span>{item.kind === 'REASSESSMENT' ? 'Reevaluación' : 'Evaluación inicial'}</span>
                <strong>
                  {item.status === 'FINALIZED' ? 'Diagnóstico finalizado' : 'En curso'}
                </strong>
              </button>
            ))}
          </section>
        ) : null}
      </>
    );
  }

  const missingSector = !details.data?.sector;
  return (
    <AssessmentShell
      title={
        setup.data?.state === 'LEGACY_CONFIGURED'
          ? 'Realiza la nueva Evaluación SST'
          : 'Prepara la evaluación de tu empresa'
      }
      description={
        setup.data?.state === 'LEGACY_CONFIGURED'
          ? 'Tu operación histórica sigue disponible. Esta evaluación añade un diagnóstico canónico sin reemplazarla.'
          : 'Confirmemos la actividad principal y la topología antes de crear la sesión.'
      }
      aside={
        <div className="assessment-scope-note">
          <strong>Antes de comenzar</strong>
          <p>
            Cuando inicies, congelaremos este contexto. Los cambios posteriores requerirán una nueva
            evaluación.
          </p>
        </div>
      }
    >
      {missingSector ? (
        <section className="assessment-preflight-card">
          <h2>¿Cuál es la actividad principal de esta empresa?</h2>
          <p>La guardaremos en el perfil de la empresa antes de crear la evaluación.</p>
          {canConfigureCompany ? (
            <>
              <label className="field">
                <span>Actividad principal</span>
                <input value={sector} onChange={(event) => setSector(event.target.value)} />
              </label>
              <button
                className="button"
                type="button"
                disabled={sector.trim().length < 2 || saveSector.isPending}
                onClick={() => saveSector.mutate()}
              >
                {saveSector.isPending ? 'Guardando…' : 'Guardar actividad'}
              </button>
            </>
          ) : (
            <p className="field-error">
              Una persona administradora debe completar este dato antes de continuar.
            </p>
          )}
        </section>
      ) : null}
      <section className="assessment-preflight-card">
        <h2>Centros incluidos</h2>
        <p>
          Revisa nombres y ciudades ahora. La topología no cambiará silenciosamente durante la
          evaluación.
        </p>
        <div className="assessment-center-list">
          {centers.data
            ?.filter(({ isActive }) => isActive)
            .map((center) =>
              canConfigureCompany ? (
                <EditableCenterRow
                  key={center.id}
                  center={center}
                  disabled={updateCenter.isPending}
                  onSave={(next) => updateCenter.mutate(next)}
                />
              ) : (
                <div key={center.id}>
                  <strong>{center.name}</strong>
                  <span>{center.city || 'Ciudad no indicada'}</span>
                </div>
              ),
            )}
        </div>
        {canConfigureCompany ? (
          <div className="assessment-inline-form">
            <label>
              <span>Nuevo centro</span>
              <input
                value={newCenterName}
                onChange={(event) => setNewCenterName(event.target.value)}
              />
            </label>
            <label>
              <span>Ciudad · opcional</span>
              <input
                value={newCenterCity}
                onChange={(event) => setNewCenterCity(event.target.value)}
              />
            </label>
            <button
              className="button secondary"
              type="button"
              disabled={newCenterName.trim().length < 2 || addCenter.isPending}
              onClick={() => addCenter.mutate()}
            >
              Agregar centro
            </button>
          </div>
        ) : null}
      </section>
      {message ? <p role="status">{message}</p> : null}
      {createAssessment.error || saveSector.error || addCenter.error || updateCenter.error ? (
        <p className="field-error" role="alert">
          {assessmentErrorMessage(
            [createAssessment.error, saveSector.error, addCenter.error, updateCenter.error].find(
              Boolean,
            ),
          )}
        </p>
      ) : null}
      <button
        className="button assessment-primary-action"
        type="button"
        disabled={
          missingSector ||
          createAssessment.isPending ||
          !centers.data?.some(({ isActive }) => isActive)
        }
        onClick={() => createAssessment.mutate({ kind: 'INITIAL_ASSESSMENT' })}
      >
        {createAssessment.isPending ? 'Creando evaluación…' : 'Comenzar entrevista'}
      </button>
      {history.data?.length ? (
        <section className="assessment-history">
          <h2>Historial</h2>
          {history.data.map((item) => (
            <button type="button" key={item.id} onClick={() => setSelectedSessionId(item.id)}>
              <span>{item.kind === 'REASSESSMENT' ? 'Reevaluación' : 'Evaluación inicial'}</span>
              <strong>{item.status === 'FINALIZED' ? 'Diagnóstico finalizado' : 'En curso'}</strong>
            </button>
          ))}
        </section>
      ) : null}
    </AssessmentShell>
  );
}
