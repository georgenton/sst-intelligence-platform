'use client';

import { Card } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import {
  ContextSummary,
  WorkspaceHeader,
  WorkspaceMain,
  WorkspaceSection,
  WorkspaceShell,
} from './workspace';

type ProfileVersion = {
  id: string;
  version: number;
  snapshot: {
    schemaVersion: string;
    organization: {
      country: string;
      sector?: string;
      workCenterCount: number;
      workerCount?: number;
      managementPriority?: string;
    };
    contextFacts?: Array<{
      key: string;
      value: string;
      provenance: { source: string; note?: string };
    }>;
  };
  createdAt: string;
};
type GapItem = {
  key: string;
  title: string;
  type: string;
  expectedState: string;
  knownState: string;
  explanation: string;
  professionalReviewRequired: boolean;
};
type GapAnalysis = {
  id: string;
  version: number;
  sourceType: string;
  sourceId: string;
  items: GapItem[];
  createdAt: string;
};
type Page<T> = { items: T[]; total: number };
type ProfileFormValues = {
  workerCount: string;
  managementPriority: string;
  hasPhysicalSite: string;
  administrativeOrRemoteOnly: string;
  hasContractorsOrExternalPersonnel: string;
};

function useOrgApi() {
  const auth = useAuth();
  const organization = useOrganization();
  return {
    organization,
    request: <T,>(path: string, init?: RequestInit) =>
      auth.request<T>(path, init, organization.activeId!),
  };
}

export function AdaptiveProfileAndGaps() {
  const api = useOrgApi();
  const queryClient = useQueryClient();
  const orgId = api.organization.activeId;
  const [sourceType, setSourceType] = useState<'ADAPTIVE_CONFIGURATION' | 'UNIFIED_SST_EVALUATION'>(
    'ADAPTIVE_CONFIGURATION',
  );
  const [sourceId, setSourceId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const profileForm = useForm<ProfileFormValues>({
    defaultValues: {
      workerCount: '',
      managementPriority: 'ROUTINE',
      hasPhysicalSite: '',
      administrativeOrRemoteOnly: '',
      hasContractorsOrExternalPersonnel: '',
    },
  });
  const profiles = useQuery({
    queryKey: queryKeys.organization.applicabilityProfileVersions(orgId ?? 'inactive'),
    queryFn: ({ signal }) =>
      api.request<ProfileVersion[]>('/applicability/profile-versions', { signal }),
    enabled: Boolean(orgId),
  });
  const gaps = useQuery({
    queryKey: queryKeys.organization.adaptiveGapAnalyses(orgId ?? 'inactive'),
    queryFn: ({ signal }) =>
      api.request<Page<GapAnalysis>>('/adaptive-intelligence/gap-analyses', { signal }),
    enabled: Boolean(orgId),
  });
  const createProfile = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      api.request('/applicability/profile-versions', {
        method: 'POST',
        body: JSON.stringify({
          workerCount: values.workerCount ? Number(values.workerCount) : undefined,
          managementPriority: values.managementPriority,
          hasPhysicalSite:
            values.hasPhysicalSite === '' ? undefined : values.hasPhysicalSite === 'true',
          administrativeOrRemoteOnly:
            values.administrativeOrRemoteOnly === ''
              ? undefined
              : values.administrativeOrRemoteOnly === 'true',
          hasContractorsOrExternalPersonnel:
            values.hasContractorsOrExternalPersonnel === ''
              ? undefined
              : values.hasContractorsOrExternalPersonnel === 'true',
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.applicabilityProfileVersions(orgId!),
      }),
  });
  const createGap = useMutation({
    mutationFn: () =>
      api.request('/adaptive-intelligence/gap-analyses', {
        method: 'POST',
        body: JSON.stringify({ sourceType, sourceId }),
      }),
    onSuccess: () => {
      setSourceId('');
      return queryClient.invalidateQueries({
        queryKey: queryKeys.organization.adaptiveGapAnalyses(orgId!),
      });
    },
  });
  const latestGap = gaps.data?.items[0];
  const convert = useMutation({
    mutationFn: () =>
      api.request(`/adaptive-intelligence/gap-analyses/${latestGap!.id}/plan-draft`, {
        method: 'POST',
        body: JSON.stringify({
          selectedItemKeys: selected,
          name: `Plan de brechas V${latestGap!.version}`,
          periodStart: new Date().toISOString().slice(0, 10),
          periodEnd: new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
        }),
      }),
    onSuccess: () => setSelected([]),
  });
  const latestProfile = profiles.data?.[0];
  return (
    <WorkspaceShell className="adaptive-field-shell">
      <WorkspaceMain>
        <WorkspaceHeader
          eyebrow="Contexto adaptativo"
          title="Perfil SST y análisis de brechas"
          description="Distingue hechos conocidos, desconocidos y su procedencia. Las brechas son insumos operativos, no declaraciones de cumplimiento."
        />
        <ContextSummary>
          <span>Perfil versionado {latestProfile ? `V${latestProfile.version}` : 'pendiente'}</span>
          <span>
            {latestGap ? `${latestGap.items.length} brechas descriptivas` : 'Sin análisis'}
          </span>
          <span>Decisión profesional explícita</span>
        </ContextSummary>
        <WorkspaceSection title="Lo que sabemos" eyebrow="Perfil V2">
          {!latestProfile ? (
            <p>No existe un perfil SST todavía.</p>
          ) : (
            <>
              <p>
                {latestProfile.snapshot.organization.country} ·{' '}
                {latestProfile.snapshot.organization.sector ?? 'Sector sin declarar'} ·{' '}
                {latestProfile.snapshot.organization.workCenterCount} centros
              </p>
              <div className="intelligence-grid">
                {(latestProfile.snapshot.contextFacts ?? []).map((fact) => (
                  <Card key={fact.key}>
                    <strong>{fact.key.replaceAll('_', ' ')}</strong>
                    <p>
                      {fact.value === 'UNKNOWN'
                        ? 'Desconocido / pendiente'
                        : fact.value === 'KNOWN_TRUE'
                          ? 'Conocido: sí'
                          : 'Conocido: no'}
                    </p>
                    <small>
                      {fact.provenance.source.replaceAll('_', ' ')}
                      {fact.provenance.note ? ` · ${fact.provenance.note}` : ''}
                    </small>
                  </Card>
                ))}
              </div>
            </>
          )}
        </WorkspaceSection>
        <WorkspaceSection title="Nuevo snapshot" eyebrow="Declaración organizacional">
          <form
            className="responsive-form"
            onSubmit={profileForm.handleSubmit((values) => createProfile.mutate(values))}
          >
            <label>
              Personas trabajadoras
              <input type="number" min="1" {...profileForm.register('workerCount')} />
            </label>
            <label>
              Prioridad de gestión
              <select {...profileForm.register('managementPriority')}>
                <option value="ROUTINE">Rutina</option>
                <option value="FOCUSED">Atención focalizada</option>
                <option value="URGENT">Atención urgente</option>
              </select>
            </label>
            {(
              [
                ['hasPhysicalSite', '¿Existe sitio físico?'],
                ['administrativeOrRemoteOnly', '¿Operación solo administrativa/remota?'],
                ['hasContractorsOrExternalPersonnel', '¿Hay contratistas o personal externo?'],
              ] as const
            ).map(([name, label]) => (
              <label key={name}>
                {label}
                <select {...profileForm.register(name)}>
                  <option value="">Desconocido</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
            ))}
            <button disabled={createProfile.isPending}>Guardar nueva versión</button>
          </form>
        </WorkspaceSection>
        <WorkspaceSection title="Análisis de brechas" eyebrow="Esperado vs estado conocido">
          <form
            className="responsive-form"
            onSubmit={(event) => {
              event.preventDefault();
              createGap.mutate();
            }}
          >
            <label>
              Origen
              <select
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as typeof sourceType)}
              >
                <option value="ADAPTIVE_CONFIGURATION">Propuesta adaptativa</option>
                <option value="UNIFIED_SST_EVALUATION">Evaluación SST unificada</option>
              </select>
            </label>
            <label>
              ID exacto del origen
              <input
                value={sourceId}
                onChange={(event) => setSourceId(event.target.value)}
                required
                pattern="[0-9a-fA-F-]{36}"
              />
            </label>
            <button disabled={createGap.isPending}>Crear snapshot de brechas</button>
          </form>
          {latestGap?.items.map((item) => (
            <label className="gap-row" key={item.key}>
              <input
                type="checkbox"
                checked={selected.includes(item.key)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, item.key]
                      : current.filter((key) => key !== item.key),
                  )
                }
              />
              <span>
                <strong>{item.title}</strong>
                <small>
                  {item.type.replaceAll('_', ' ')} · esperado {item.expectedState} · conocido{' '}
                  {item.knownState}
                </small>
                <span>{item.explanation}</span>
              </span>
            </label>
          ))}
          {latestGap ? (
            <button
              type="button"
              disabled={!selected.length || convert.isPending}
              onClick={() => convert.mutate()}
            >
              Convertir selección en borrador de Plan Operativo
            </button>
          ) : null}
          <p className="boundary-note">
            La prioridad de gestión no cambia la aplicabilidad, un Requirement ni el resultado de
            una metodología de riesgo.
          </p>
        </WorkspaceSection>
      </WorkspaceMain>
    </WorkspaceShell>
  );
}

type SearchResult = {
  id: string;
  type: string;
  title: string;
  snippet: string;
  status?: string;
  workCenterName?: string;
  deepLink: string;
};
export function OperationalSearch() {
  const api = useOrgApi();
  const orgId = api.organization.activeId;
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const results = useQuery({
    queryKey: queryKeys.organization.operationalSearch(orgId ?? 'inactive', q),
    queryFn: ({ signal }) =>
      api.request<Page<SearchResult>>(`/operational-search?q=${encodeURIComponent(q)}`, { signal }),
    enabled: Boolean(orgId && q.length >= 2),
  });
  return (
    <WorkspaceShell className="adaptive-field-shell">
      <WorkspaceMain>
        <WorkspaceHeader
          eyebrow="Búsqueda PostgreSQL"
          title="Buscar en la operación"
          description="Resultados acotados a la organización activa, ordenados de forma determinista y vinculados al registro canónico."
        />
        <WorkspaceSection title="Consulta" eyebrow="11 dominios operativos">
          <form
            className="search-bar"
            onSubmit={(event) => {
              event.preventDefault();
              setQ(input.trim());
            }}
          >
            <label className="sr-only" htmlFor="operational-search">
              Texto a buscar
            </label>
            <input
              id="operational-search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              minLength={2}
              placeholder="Hallazgo, inspección, observación, acción…"
            />
            <button>Buscar</button>
          </form>
          {results.isFetching ? <p role="status">Buscando…</p> : null}
          {results.data?.items.map((item) => (
            <Card key={`${item.type}:${item.id}`}>
              <p className="eyebrow">
                {item.type.replaceAll('_', ' ')} · {item.status ?? 'Sin estado'}
              </p>
              <h3>{item.title}</h3>
              <p>{item.snippet}</p>
              <small>{item.workCenterName ?? 'Contexto organizacional'}</small>
              <p>
                <Link href={item.deepLink}>Abrir registro</Link>
              </p>
            </Card>
          ))}
          {results.data && results.data.items.length === 0 ? (
            <p>No se encontraron resultados.</p>
          ) : null}
        </WorkspaceSection>
      </WorkspaceMain>
    </WorkspaceShell>
  );
}

type IntelligenceSummary = {
  attention: { overdueActions: number; professionalReviewPending: number };
  counts: Record<string, Array<{ dimension: string; status?: string; count: number }>>;
  trends: Array<{ month: string; type: string; count: number }>;
  riskMethods: Array<{
    methodKey: string;
    version: string;
    initialCount: number;
    residualCount: number;
  }>;
  mixedMethodComparison: { comparable: boolean };
};
export function ManagementIntelligence() {
  const api = useOrgApi();
  const orgId = api.organization.activeId;
  const summary = useQuery({
    queryKey: queryKeys.organization.managementIntelligence(orgId ?? 'inactive'),
    queryFn: ({ signal }) =>
      api.request<IntelligenceSummary>('/management-intelligence/summary', { signal }),
    enabled: Boolean(orgId),
  });
  const total = (key: string) =>
    (summary.data?.counts[key] ?? []).reduce((sum, item) => sum + item.count, 0);
  return (
    <WorkspaceShell className="adaptive-field-shell">
      <WorkspaceMain>
        <WorkspaceHeader
          eyebrow="Inteligencia gerencial"
          title="Atención, decisiones y tendencias"
          description="Métricas operativas factuales. No califica personas ni compara puntuaciones incompatibles."
        />
        <ContextSummary>
          <span>{summary.data?.attention.overdueActions ?? 0} acciones vencidas</span>
          <span>
            {summary.data?.attention.professionalReviewPending ?? 0} revisiones pendientes
          </span>
          <span>
            {summary.data?.mixedMethodComparison.comparable
              ? 'Una metodología en el corte'
              : 'Métodos separados'}
          </span>
        </ContextSummary>
        <WorkspaceSection title="Concentración operativa" eyebrow="Datos canónicos">
          <div className="management-kpis">
            {(
              [
                ['findings', 'Hallazgos'],
                ['observations', 'Observaciones'],
                ['incidents', 'Incidentes'],
                ['actions', 'Acciones'],
                ['plan', 'Trabajo planificado'],
                ['training', 'Capacitación'],
              ] as const
            ).map(([key, label]) => (
              <Card key={key}>
                <strong>{total(key)}</strong>
                <span>{label}</span>
              </Card>
            ))}
          </div>
        </WorkspaceSection>
        <WorkspaceSection title="Metodologías sin mezcla" eyebrow="Compatibilidad estricta">
          {summary.data?.riskMethods.map((method) => (
            <Card key={`${method.methodKey}:${method.version}`}>
              <h3>
                {method.methodKey} · {method.version}
              </h3>
              <p>
                {method.initialCount} valoraciones iniciales · {method.residualCount} residuales
                registradas
              </p>
            </Card>
          ))}
          <p className="boundary-note">
            Los residuales nulos no se convierten en nivel bajo. Cada serie conserva la versión
            exacta.
          </p>
        </WorkspaceSection>
        <WorkspaceSection title="Tendencia" eyebrow="Mes y tipo">
          {summary.data?.trends.map((item) => (
            <p key={`${item.month}:${item.type}`}>
              {new Date(item.month).toLocaleDateString('es-EC', {
                month: 'short',
                year: 'numeric',
              })}{' '}
              · {item.type.replaceAll('_', ' ')}: {item.count}
            </p>
          ))}
        </WorkspaceSection>
      </WorkspaceMain>
    </WorkspaceShell>
  );
}

export function FieldOperationsHub() {
  return (
    <WorkspaceShell className="adaptive-field-shell field-hub">
      <WorkspaceMain>
        <WorkspaceHeader
          eyebrow="Trabajo en campo"
          title="Registrar, verificar y dar seguimiento"
          description="Experiencia web móvil para trabajo en sitio. Requiere conexión; no mantiene una cola offline ni duplica estados canónicos."
        />
        <div className="field-action-grid">
          <Link className="field-action" href="/app/safety-observations">
            <strong>Observación rápida</strong>
            <span>Categoría, descripción, ubicación, hora y evidencia opcional.</span>
          </Link>
          <Link className="field-action" href="/app/inspections/new">
            <strong>Nueva inspección</strong>
            <span>Alcance, profundidad, checklist, evidencia y hallazgos.</span>
          </Link>
          <Link className="field-action" href="/app/inspections">
            <strong>Continuar inspección</strong>
            <span>Retoma verificaciones y acciones pendientes.</span>
          </Link>
          <Link className="field-action" href="/app/work">
            <strong>Acciones y atención</strong>
            <span>Abre la cola canónica, vencimientos y asignaciones.</span>
          </Link>
          <Link className="field-action" href="/app/incidents">
            <strong>Incidente</strong>
            <span>Intake seguro; la investigación completa continúa en escritorio.</span>
          </Link>
          <Link className="field-action" href="/app/search">
            <strong>Buscar registro</strong>
            <span>Encuentra contexto operacional dentro de la organización activa.</span>
          </Link>
        </div>
        <p className="boundary-note">
          No hay reporte anónimo, QR público, sincronización offline profunda ni captura de cámara
          obligatoria.
        </p>
      </WorkspaceMain>
    </WorkspaceShell>
  );
}
