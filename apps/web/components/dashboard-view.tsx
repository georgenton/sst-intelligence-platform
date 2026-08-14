'use client';

import { Card, StatusBadge } from '@sst/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { resolveAsyncCollectionState, resolveAttentionState } from '@/lib/command-center-state';
import { queryKeys } from '@/lib/query-keys';
import { useOrganization } from './app-shell';
import { useAuth } from './auth-provider';
import { useDashboardData, type DashboardData, type ModuleItem } from './use-app-data';

type InspectionAlert = {
  id: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  finding: {
    id: string;
    title: string;
    recurrenceCount: number;
    workCenter: { name: string };
    inspection: { id: string };
  };
};

type TechnicalAssessment = {
  id: string;
  title: string;
  status: string;
  methodKey: string;
  methodVersion: string;
  workCenter: { name: string };
  result?: { score: number | null; level: string | null };
};

type TechnicalRiskResponse = {
  items: TechnicalAssessment[];
  analytics: {
    total: number;
    draft: number;
    completed: number;
    reviewed: number;
    highCritical: number;
  };
};

const riskLabels: Record<string, string> = {
  LOW: 'Bajo',
  MODERATE: 'Moderado',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
};

const moduleStatusLabels: Record<string, string> = {
  ACTIVE: 'Activo',
  DEMO: 'Demostración',
  EXPIRED: 'Vencido',
  INACTIVE: 'Inactivo',
};

const alertTypeLabels: Record<string, string> = {
  RECURRENCE: 'Recurrencia',
  RESIDUAL_RISK: 'Riesgo residual',
};

function CommandMetric({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link className="command-metric" href={href} aria-label={`${value} ${label}. Abrir ${label}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <span aria-hidden="true" className="command-metric__action">
        Ver detalle →
      </span>
    </Link>
  );
}

function CommandSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="command-section">
      <header>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}

function ModuleCard({ item }: { item: ModuleItem }) {
  const destination =
    item.module.key === 'INSPECTIONS_INTELLIGENCE'
      ? '/app/inspections'
      : item.module.key === 'TECHNICAL_RISK'
        ? '/app/technical-risk'
        : `/app/modules/${item.module.key}`;
  return (
    <Card className="command-module-card">
      <div>
        <StatusBadge>{moduleStatusLabels[item.status] ?? item.status}</StatusBadge>
        <h3>{item.module.name}</h3>
        <p>{item.module.description}</p>
      </div>
      <Link href={destination}>Abrir {item.module.name} →</Link>
    </Card>
  );
}

function InspectionAttention({
  inspections,
}: {
  inspections: NonNullable<DashboardData['inspections']>;
}) {
  const items = [
    inspections.highCriticalFindings > 0
      ? {
          id: 'risk',
          title: `${inspections.highCriticalFindings} hallazgos altos o críticos`,
          detail: 'El nivel proviene del cálculo determinístico registrado en cada hallazgo.',
          href: '/app/inspections/analytics',
          action: 'Ver análisis',
        }
      : null,
    inspections.overdueActions > 0
      ? {
          id: 'overdue',
          title: `${inspections.overdueActions} acciones vencidas`,
          detail: 'La fecha límite ya pasó y la acción todavía no está completada ni cancelada.',
          href: '/app/inspections',
          action: 'Ver inspecciones',
        }
      : null,
    inspections.recurrences > 0
      ? {
          id: 'recurrence',
          title: `${inspections.recurrences} alertas de recurrencia`,
          detail: 'La recurrencia requiere seguimiento; no confirma una causa raíz.',
          href: '/app/inspections/alerts',
          action: 'Ver alertas',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) return null;
  return (
    <div className="command-attention-list">
      {items.map((item) => (
        <article className="command-attention-item" key={item.id}>
          <div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </div>
          <Link className="button secondary" href={item.href}>
            {item.action}
          </Link>
        </article>
      ))}
    </div>
  );
}

export function DashboardView() {
  const auth = useAuth();
  const organization = useOrganization();
  const dashboard = useDashboardData();
  const organizationId = organization.activeId;
  const features = dashboard.data?.entitlements.features;
  const inspectionsEnabled = features?.['module.inspections'] === true;
  const technicalRiskEnabled = features?.['module.technical_risk'] === true;

  const alerts = useQuery({
    queryKey: queryKeys.organization.inspectionAlerts(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<{ items: InspectionAlert[] }>(
        '/inspections/alerts',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && inspectionsEnabled),
  });
  const technicalRisk = useQuery({
    queryKey: queryKeys.organization.technicalRiskAssessments(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<TechnicalRiskResponse>(
        '/technical-risk/assessments',
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId && technicalRiskEnabled),
  });

  if (!organization.activeId)
    return (
      <div className="command-center command-center--empty">
        <p className="eyebrow">Inicio</p>
        <h1>Configura tu organización</h1>
        <p>La organización activa define el contexto seguro de cada consulta y operación.</p>
        <Link className="button" href="/app/organizations">
          Crear organización
        </Link>
      </div>
    );

  if (dashboard.isLoading)
    return (
      <div className="command-center" aria-busy="true" aria-label="Cargando Centro de comando">
        <div className="command-skeleton command-skeleton--title" />
        <div className="command-metrics">
          <div className="command-skeleton" />
          <div className="command-skeleton" />
          <div className="command-skeleton" />
        </div>
      </div>
    );

  if (dashboard.isError || !dashboard.data)
    return (
      <div className="command-center">
        <p className="eyebrow">Inicio</p>
        <h1>Centro de comando</h1>
        <Card className="command-error" role="alert">
          <h2>No pudimos cargar el contexto operativo</h2>
          <p>Reintenta para consultar los datos de la organización activa.</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => void dashboard.refetch()}
          >
            Reintentar
          </button>
        </Card>
      </div>
    );

  const data = dashboard.data;
  const inspectionAttentionCount = data.inspections
    ? data.inspections.highCriticalFindings +
      data.inspections.overdueActions +
      data.inspections.recurrences
    : 0;
  const technicalRiskItems = technicalRiskEnabled ? (technicalRisk.data?.items ?? []) : [];
  const completedAssessments = technicalRiskItems
    .filter((item) => item.status === 'COMPLETED')
    .slice(0, 3);
  const drafts = technicalRiskItems
    .filter((item) => item.status === 'DRAFT' || item.status === 'IN_PROGRESS')
    .slice(0, 3);
  const alertItems = inspectionsEnabled ? (alerts.data?.items ?? []) : [];
  const alertsState = resolveAsyncCollectionState({
    enabled: inspectionsEnabled,
    status: alerts.status,
    itemCount: alertItems.length,
  });
  const technicalRiskAttentionState = resolveAsyncCollectionState({
    enabled: technicalRiskEnabled,
    status: technicalRisk.status,
    itemCount: completedAssessments.length,
  });
  const technicalRiskProgressState = resolveAsyncCollectionState({
    enabled: technicalRiskEnabled,
    status: technicalRisk.status,
    itemCount: drafts.length,
  });
  const attention = resolveAttentionState({
    knownAttentionCount: inspectionAttentionCount + completedAssessments.length + alertItems.length,
    sourceStates: [alertsState, technicalRiskAttentionState],
  });

  return (
    <div className="command-center">
      <header className="command-header">
        <div>
          <p className="eyebrow">Inicio · {data.organization.name}</p>
          <h1>Centro de comando</h1>
          <p>
            Revisa atención operativa, trabajo en curso y accesos disponibles con datos de la
            organización activa.
          </p>
        </div>
        <div className="command-header__actions" aria-label="Acciones disponibles">
          {technicalRiskEnabled && (
            <Link className="button secondary" href="/app/technical-risk/new">
              Nueva evaluación
            </Link>
          )}
          {inspectionsEnabled && (
            <Link className="button" href="/app/inspections/new">
              Nueva inspección
            </Link>
          )}
        </div>
      </header>

      <div className="command-context" role="note">
        <div>
          <span>Plan actual</span>
          <strong>{data.entitlements.plan.name}</strong>
        </div>
        <p>Los módulos y límites efectivos provienen de la API.</p>
      </div>

      <CommandSection
        title="Vista operativa"
        description="Cada indicador abre una superficie funcional existente."
      >
        <div className="command-metrics">
          <CommandMetric
            href="/app/settings/organization"
            label="centros de trabajo"
            value={data.organization._count.workCenters}
          />
          <CommandMetric
            href="/app/settings/members"
            label="miembros"
            value={data.organization._count.memberships}
          />
          {data.inspections && (
            <>
              <CommandMetric
                href="/app/inspections/analytics"
                label="hallazgos altos o críticos"
                value={data.inspections.highCriticalFindings}
              />
              <CommandMetric
                href="/app/inspections"
                label="acciones vencidas"
                value={data.inspections.overdueActions}
              />
              <CommandMetric
                href="/app/inspections/alerts"
                label="recurrencias activas"
                value={data.inspections.recurrences}
              />
            </>
          )}
          {technicalRisk.data && (
            <CommandMetric
              href="/app/technical-risk"
              label="evaluaciones técnicas"
              value={technicalRisk.data.analytics.total}
            />
          )}
        </div>
      </CommandSection>

      <div className="command-grid">
        <CommandSection
          title="Requiere atención"
          description="Señales existentes, sin un puntaje ni prioridad añadidos por la interfaz."
        >
          {data.inspections && <InspectionAttention inspections={data.inspections} />}
          {completedAssessments.length > 0 && (
            <div className="command-attention-list">
              {completedAssessments.map((assessment) => (
                <article className="command-attention-item" key={assessment.id}>
                  <div>
                    <h3>{assessment.title}</h3>
                    <p>
                      Evaluación completada. Consulta el resultado y el estado actual de revisión.
                    </p>
                    <div className="command-item-meta">
                      <span>{assessment.workCenter.name}</span>
                      <span className="mono">
                        {assessment.methodKey} {assessment.methodVersion}
                      </span>
                      {assessment.result?.level && (
                        <span
                          className={`risk-badge risk-${assessment.result.level.toLowerCase()}`}
                        >
                          {riskLabels[assessment.result.level] ?? assessment.result.level}
                          {assessment.result.score === null ? '' : ` · ${assessment.result.score}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link className="button secondary" href={`/app/technical-risk/${assessment.id}`}>
                    Abrir evaluación
                  </Link>
                </article>
              ))}
            </div>
          )}
          {attention.sourcesLoading && <p role="status">Comprobando señales adicionales…</p>}
          {attention.showEmpty && (
            <Card className="command-empty-state">
              <h3>Sin elementos que requieran atención hoy</h3>
              <p>Los indicadores disponibles no reportan asuntos activos en este momento.</p>
            </Card>
          )}
          {alertsState === 'error' && (
            <p className="command-section-error" role="alert">
              No pudimos comprobar las alertas detalladas. Puedes abrir el módulo para reintentar.
            </p>
          )}
          {technicalRiskAttentionState === 'error' && (
            <p className="command-section-error" role="alert">
              No pudimos comprobar las evaluaciones técnicas para esta sección.
            </p>
          )}
          {alertItems.length > 0 ? (
            <div className="command-alerts">
              <h3>Alertas abiertas</h3>
              {alertItems.slice(0, 3).map((alert) => (
                <Link
                  href={`/app/inspections/${alert.finding.inspection.id}/findings/${alert.finding.id}`}
                  className="command-alert-link"
                  key={alert.id}
                >
                  <strong>{alert.finding.title}</strong>
                  <span>{alert.finding.workCenter.name}</span>
                  <span>{alertTypeLabels[alert.type] ?? alert.type}</span>
                </Link>
              ))}
              <Link href="/app/inspections/alerts">Ver todas las alertas →</Link>
            </div>
          ) : null}
        </CommandSection>

        {technicalRiskEnabled && (
          <CommandSection
            title="En progreso"
            description="Trabajo real que puede continuarse ahora."
          >
            {technicalRiskProgressState === 'loading' && (
              <Card className="command-empty-state" role="status">
                <h3>Comprobando evaluaciones en curso…</h3>
                <p>Estamos consultando el trabajo disponible para esta organización.</p>
              </Card>
            )}
            {technicalRiskProgressState === 'error' && (
              <p className="command-section-error" role="alert">
                No pudimos cargar las evaluaciones técnicas.
              </p>
            )}
            {technicalRiskProgressState === 'success-with-data' && (
              <div className="command-progress-list">
                {drafts.map((assessment) => (
                  <Link href={`/app/technical-risk/${assessment.id}`} key={assessment.id}>
                    <span>
                      <StatusBadge>
                        {assessment.status === 'DRAFT' ? 'Borrador' : 'En progreso'}
                      </StatusBadge>
                      <strong>{assessment.title}</strong>
                      <small>{assessment.workCenter.name}</small>
                    </span>
                    <span aria-hidden="true">Continuar →</span>
                  </Link>
                ))}
              </div>
            )}
            {technicalRiskProgressState === 'success-empty' && (
              <Card className="command-empty-state">
                <h3>Sin evaluaciones en curso</h3>
                <p>No hay borradores o evaluaciones técnicas en progreso disponibles.</p>
                <Link href="/app/technical-risk/new">Nueva evaluación →</Link>
              </Card>
            )}
          </CommandSection>
        )}
      </div>

      <CommandSection
        title="Módulos operativos"
        description="Disponibilidad y estado efectivos de esta organización."
      >
        {data.organization.modules.length > 0 ? (
          <div className="command-modules">
            {data.organization.modules.map((item) => (
              <ModuleCard item={item} key={item.module.key} />
            ))}
          </div>
        ) : (
          <Card className="command-empty-state">
            <h3>Sin módulos operativos habilitados</h3>
            <p>Consulta el catálogo y el plan actual para conocer las capacidades disponibles.</p>
            <Link href="/app/modules">Ver módulos →</Link>
          </Card>
        )}
      </CommandSection>
    </div>
  );
}
