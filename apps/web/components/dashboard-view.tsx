'use client';

import { Card } from '@sst/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import { useDashboardData } from './use-app-data';
import { ContextSummary, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from './workspace';

type QueueItem = {
  type: string;
  sourceId: string;
  title: string;
  summary: string;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string | null;
  overdue: boolean;
  module: string;
  deepLink: string;
  origin: string;
  workCenter: { id: string; name: string } | null;
  assignee: { id: string; displayName: string } | null;
  regulatoryContext: { label: string; candidate: boolean } | null;
};

type QueueResponse = { items: QueueItem[]; total: number; generatedAt: string };

const statusLabels: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En curso',
  BLOCKED: 'Bloqueado',
  READY_FOR_REVIEW: 'Listo para revisión',
  COMPLETED: 'Completado',
  NEEDS_REVISION: 'Requiere ajustes',
  NEEDS_EXPERT_REVIEW: 'Revisión experta pendiente',
  PENDING_VERIFICATION: 'Verificación pendiente',
};

const moduleLabels: Record<string, string> = {
  INSPECTIONS: 'Inspecciones',
  TECHNICAL_RISK: 'Riesgo técnico',
  REGULATORY: 'Contexto normativo',
  OPERATIONAL_EXECUTION: 'Ejecución operativa',
  WORK_PERMITS: 'Permisos de trabajo',
};

function formatDue(item: QueueItem) {
  if (!item.dueAt) return 'Sin fecha comprometida';
  return `${item.overdue ? 'Venció' : 'Fecha objetivo'} ${new Date(item.dueAt).toLocaleDateString('es-EC')}`;
}

function AttentionRow({ item }: { item: QueueItem }) {
  return (
    <article className="command-attention-item command-attention-item--compact">
      <div>
        <div className="command-item-meta">
          <span>{moduleLabels[item.module] ?? 'Trabajo operativo'}</span>
          <span className={`queue-priority queue-priority-${item.priority.toLowerCase()}`}>
            {item.priority === 'URGENT' ? 'Urgente' : item.priority === 'HIGH' ? 'Alta' : 'Normal'}
          </span>
          <span>{statusLabels[item.status] ?? 'Pendiente'}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <small>
          {item.workCenter?.name ?? 'Alcance de organización'} · {formatDue(item)}
          {item.assignee ? ` · ${item.assignee.displayName}` : ''}
        </small>
        {item.regulatoryContext?.candidate ? (
          <p className="candidate-notice">
            Referencia candidata: requiere revisión antes de tratarla como aprobada.
          </p>
        ) : null}
      </div>
      <Link className="button secondary" href={item.deepLink}>
        Abrir
      </Link>
    </article>
  );
}

function Metric({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link className="command-metric" href={href}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>Ver detalle →</small>
    </Link>
  );
}

export function DashboardView() {
  const auth = useAuth();
  const organization = useOrganization();
  const dashboard = useDashboardData();
  const organizationId = organization.activeId;
  const queue = useQuery({
    queryKey: queryKeys.organization.workQueue(organizationId ?? 'inactive', 'dashboard'),
    queryFn: ({ signal }) =>
      auth.request<QueueResponse>('/work-queue?pageSize=8', { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });

  if (!organizationId)
    return (
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Inicio"
          title="Configura tu organización"
          description="La organización activa define el contexto seguro de cada consulta y operación."
          actions={
            <Link className="button" href="/app/organizations">
              Crear organización
            </Link>
          }
        />
      </WorkspaceShell>
    );

  if (dashboard.isLoading || queue.isLoading)
    return (
      <WorkspaceShell className="command-center">
        <div className="command-skeleton command-skeleton--title" />
        <div className="command-metrics">
          <div className="command-skeleton" />
          <div className="command-skeleton" />
          <div className="command-skeleton" />
        </div>
      </WorkspaceShell>
    );

  if (dashboard.isError || !dashboard.data)
    return (
      <WorkspaceShell>
        <WorkspaceHeader
          eyebrow="Inicio"
          title="Centro de comando"
          description="No pudimos cargar el contexto operativo de la organización activa."
          actions={
            <button
              className="button secondary"
              type="button"
              onClick={() => void dashboard.refetch()}
            >
              Reintentar
            </button>
          }
        />
      </WorkspaceShell>
    );

  const data = dashboard.data;
  const queueItems = queue.data?.items ?? [];
  const blocked = queueItems.filter((item) => item.status === 'BLOCKED').length;
  const inProgress = queueItems.filter((item) => item.status === 'IN_PROGRESS').length;
  const pendingReview = queueItems.filter((item) =>
    ['READY_FOR_REVIEW', 'COMPLETED', 'NEEDS_EXPERT_REVIEW'].includes(item.status),
  ).length;

  return (
    <WorkspaceShell className="command-center command-center-v2">
      <WorkspaceHeader
        eyebrow={`Inicio · ${data.organization.name}`}
        title="Centro de comando"
        description="Prioriza lo que necesita atención, confirma el estado operativo y abre el análisis sin perder el contexto de la organización."
        actions={
          <>
            <Link className="button secondary" href="/app/work">
              Ver cola completa
            </Link>
            <Link className="button" href="/app/work/obligations/new">
              Nueva actividad
            </Link>
          </>
        }
      />

      <ContextSummary>
        <span>Plan {data.entitlements.plan.name}</span>
        <span>{data.organization._count.workCenters} centros de trabajo</span>
        <span>{data.organization._count.memberships} personas con acceso</span>
      </ContextSummary>

      <WorkspaceSection
        eyebrow="Prioridad"
        title="Necesita atención"
        description="Ordenado por vencimiento, fecha próxima, revisión profesional y bloqueos. Los puntajes de métodos distintos no se comparan entre sí."
        actions={<Link href="/app/work">Ver todo →</Link>}
      >
        {queue.isError ? (
          <Card role="alert">
            <h3>No pudimos consultar la cola operativa</h3>
            <p>Las demás métricas permanecen disponibles. Reintenta esta sección.</p>
            <button className="button secondary" type="button" onClick={() => void queue.refetch()}>
              Reintentar
            </button>
          </Card>
        ) : queueItems.length ? (
          <div className="command-attention-list">
            {queueItems.slice(0, 5).map((item) => (
              <AttentionRow item={item} key={`${item.type}-${item.sourceId}`} />
            ))}
          </div>
        ) : (
          <Card className="command-empty-state">
            <h3>No hay trabajo que requiera atención inmediata</h3>
            <p>Las fuentes consultadas no reportan vencimientos, revisiones o bloqueos activos.</p>
            <Link href="/app/work">Revisar toda la operación →</Link>
          </Card>
        )}
      </WorkspaceSection>

      <WorkspaceSection
        eyebrow="Seguimiento"
        title="Estado operativo"
        description="Una lectura compacta del trabajo activo; completar una actividad no certifica cumplimiento legal."
      >
        <div className="command-metrics">
          <Metric value={inProgress} label="en curso" href="/app/work?status=IN_PROGRESS" />
          <Metric value={pendingReview} label="pendientes de revisión" href="/app/work" />
          <Metric value={blocked} label="bloqueados" href="/app/work?status=BLOCKED" />
          <Metric value={queue.data?.total ?? 0} label="elementos activos" href="/app/work" />
        </div>
      </WorkspaceSection>

      <WorkspaceSection
        eyebrow="Lectura"
        title="Análisis"
        description="Indicadores del contexto actual; cada cifra conduce a su fuente funcional."
      >
        <div className="command-metrics">
          <Metric
            value={data.inspections?.highCriticalFindings ?? 0}
            label="hallazgos altos o críticos"
            href="/app/inspections/analytics"
          />
          <Metric
            value={data.inspections?.overdueActions ?? 0}
            label="acciones correctivas vencidas"
            href="/app/inspections?overdue=true"
          />
          <Metric
            value={data.inspections?.recurrences ?? 0}
            label="recurrencias activas"
            href="/app/inspections/alerts"
          />
        </div>
      </WorkspaceSection>
    </WorkspaceShell>
  );
}
