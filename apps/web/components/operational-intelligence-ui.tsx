'use client';

import { ApiClientError } from '@sst/api-client';
import { Button, Card, StatusBadge } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ContextSummary,
  TechnicalDetailsDisclosure,
  WorkspaceHeader,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type WorkCenter = { id: string; name: string; isActive: boolean };
type Signal = {
  id: string;
  workCenterId: string;
  type: 'REPEATED_FINDING' | 'OVERDUE_ACTION_CLUSTER';
  title: string;
  explanation: string;
  attention: 'REVIEW' | 'PRIORITY_REVIEW';
  status: 'ACTIVE' | 'REVIEWED' | 'CLOSED';
  ruleKey: string;
  ruleVersion: string;
  threshold: number;
  observedCount: number;
  windowStart: string;
  windowEnd: string;
  sourceRecords: Array<{ type: string; id: string; [key: string]: string }>;
  sourceDigest: string;
  version: number;
  workCenter: { id: string; name: string };
  reviewedBy?: { id: string; displayName: string } | null;
};
type Overview = {
  workCenter: WorkCenter;
  factualCounts: {
    inspections: number;
    incidents: number;
    ppe: number;
    training: number;
    permits: number;
    actions: number;
  };
  activeSignals: Array<Pick<Signal, 'id' | 'type' | 'title' | 'observedCount' | 'ruleKey'>>;
  interpretation: string;
};

const REVIEW_ROLES = new Set(['ORG_OWNER', 'ORG_ADMIN', 'SST_MANAGER']);
const statusLabels = { ACTIVE: 'Requiere revisión', REVIEWED: 'Revisada', CLOSED: 'Cerrada' };
const typeLabels = {
  REPEATED_FINDING: 'Hallazgos recurrentes',
  OVERDUE_ACTION_CLUSTER: 'Acciones vencidas',
};

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.payload.message;
  return 'No pudimos completar la operación.';
}

export function OperationalIntelligenceWorkspace() {
  const auth = useAuth();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.activeId;
  const canReview = REVIEW_ROLES.has(organization.currentRole ?? '');
  const [selectedSignalId, setSelectedSignalId] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const signalId = new URLSearchParams(window.location.search).get('signal');
    if (signalId) setSelectedSignalId(signalId);
  }, []);
  const signals = useQuery({
    queryKey: queryKeys.organization.operationalSignals(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Signal[]>('/operational-intelligence/signals', { signal }, organizationId!),
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
  const effectiveCenterId =
    selectedCenterId || signals.data?.[0]?.workCenterId || centers.data?.[0]?.id || '';
  const overview = useQuery({
    queryKey: queryKeys.organization.workCenterIntelligence(
      organizationId ?? 'inactive',
      effectiveCenterId || 'inactive',
    ),
    queryFn: ({ signal }) =>
      auth.request<Overview>(
        `/operational-intelligence/work-centers/${effectiveCenterId}/overview`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && effectiveCenterId),
  });
  const selectedSignal = useMemo(
    () =>
      signals.data?.find(({ id }) => id === selectedSignalId) ??
      signals.data?.find(({ status }) => status === 'ACTIVE') ??
      signals.data?.[0],
    [selectedSignalId, signals.data],
  );

  async function refresh() {
    if (!organizationId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.operationalSignals(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.workQueueRoot(organizationId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.scope(organizationId),
      }),
    ]);
  }
  const operation = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      auth.request(
        path,
        { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) },
        organizationId!,
      ),
    onSuccess: async () => {
      setError('');
      setNotice('Señales operativas actualizadas.');
      await refresh();
    },
    onError: (cause) => {
      setNotice('');
      setError(errorMessage(cause));
    },
  });

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Análisis determinista"
        title="Señales operativas"
        description="Patrones explicables derivados de registros canónicos. Orientan revisión profesional; no predicen eventos ni detectan causas raíz."
        context={
          <ContextSummary>
            <span>Umbral operativo V1: 3 registros en 90 días.</span>
            <span>Sin significado legal y sin puntuación de trabajador.</span>
          </ContextSummary>
        }
        actions={
          canReview ? (
            <Button
              type="button"
              disabled={operation.isPending}
              onClick={() =>
                operation.mutate({ path: '/operational-intelligence/signals/evaluate' })
              }
            >
              Evaluar registros actuales
            </Button>
          ) : undefined
        }
      />
      {notice ? (
        <p className="form-success" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <WorkspaceMain>
        <WorkspaceSection
          title="Bandeja de revisión"
          eyebrow="Señales"
          description="Solo las señales activas se proyectan a la cola de trabajo."
        >
          <div className="dashboard-grid">
            {signals.data?.map((signal) => (
              <button
                type="button"
                className="record-button"
                key={signal.id}
                onClick={() => setSelectedSignalId(signal.id)}
                aria-pressed={selectedSignal?.id === signal.id}
              >
                <strong>{signal.title}</strong>
                <span>
                  {signal.workCenter.name} · {statusLabels[signal.status]}
                </span>
              </button>
            ))}
          </div>
          {selectedSignal ? (
            <Card>
              <div className="record-heading">
                <strong>{selectedSignal.title}</strong>
                <StatusBadge>{statusLabels[selectedSignal.status]}</StatusBadge>
              </div>
              <p>{selectedSignal.explanation}</p>
              <dl className="metric-list">
                <div>
                  <dt>Regla</dt>
                  <dd>
                    {selectedSignal.ruleKey} v{selectedSignal.ruleVersion}
                  </dd>
                </div>
                <div>
                  <dt>Conteo observado</dt>
                  <dd>
                    {selectedSignal.observedCount} / umbral {selectedSignal.threshold}
                  </dd>
                </div>
                <div>
                  <dt>Ventana</dt>
                  <dd>
                    {new Date(selectedSignal.windowStart).toLocaleDateString('es-EC')} –{' '}
                    {new Date(selectedSignal.windowEnd).toLocaleDateString('es-EC')}
                  </dd>
                </div>
              </dl>
              <h3>Registros fuente</h3>
              <ul>
                {selectedSignal.sourceRecords.map((source) => (
                  <li key={`${source.type}:${source.id}`}>
                    {source.type} · <code>{source.id}</code>
                  </li>
                ))}
              </ul>
              {selectedSignal.status === 'ACTIVE' && canReview ? (
                <Button
                  type="button"
                  disabled={operation.isPending}
                  onClick={() =>
                    operation.mutate({
                      path: `/operational-intelligence/signals/${selectedSignal.id}/review`,
                      body: {
                        expectedVersion: selectedSignal.version,
                        note: 'Revisión profesional registrada desde la bandeja.',
                      },
                    })
                  }
                >
                  Marcar revisada
                </Button>
              ) : null}
              <TechnicalDetailsDisclosure>
                <p>
                  Digest de fuentes: <code>{selectedSignal.sourceDigest}</code>
                </p>
                <p>Tipo: {typeLabels[selectedSignal.type]}</p>
              </TechnicalDetailsDisclosure>
            </Card>
          ) : (
            <p>No hay señales derivadas registradas.</p>
          )}
        </WorkspaceSection>

        <WorkspaceSection
          title="Vista del centro de trabajo"
          eyebrow="Contexto 360"
          description="Conteos factuales por módulo, siempre limitados a la organización activa."
        >
          <label>
            Centro de trabajo
            <select
              value={effectiveCenterId}
              onChange={(event) => setSelectedCenterId(event.target.value)}
            >
              <option value="">Selecciona un centro</option>
              {centers.data?.map((center) => (
                <option value={center.id} key={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </label>
          {overview.data ? (
            <>
              <div className="metric-grid">
                {Object.entries(overview.data.factualCounts).map(([key, value]) => (
                  <Card key={key}>
                    <strong>{value}</strong>
                    <span>
                      {
                        (
                          {
                            inspections: 'Inspecciones',
                            incidents: 'Incidentes',
                            ppe: 'EPP',
                            training: 'Capacitación',
                            permits: 'Permisos',
                            actions: 'Acciones',
                          } as Record<string, string>
                        )[key]
                      }
                    </span>
                  </Card>
                ))}
              </div>
              <p>{overview.data.interpretation}</p>
            </>
          ) : null}
        </WorkspaceSection>
      </WorkspaceMain>
    </WorkspaceShell>
  );
}
