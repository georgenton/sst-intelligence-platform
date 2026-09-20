'use client';

import { Card } from '@sst/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { queryKeys } from '@/lib/query-keys';
import type { WorkerChoice } from '@/lib/ppe-presentation';
import { useOrganization } from './app-shell';
import { WorkspaceHeader, WorkspaceSection, WorkspaceShell } from './workspace';
import { PpeFlow, usePpeApi, type PpeApi } from './ppe-experience-ui';
import { PpeCatalogExperience } from './ppe-catalog-experience';
import { PpePositionsExperience, usePpePositions } from './ppe-positions-experience';
import { PpeServerSelection } from './ppe-server-selection';
import styles from './ppe.module.css';

type View = 'landing' | 'catalog' | 'positions' | 'people';
export function PpeWorkspace({
  view = 'landing',
  positionId,
}: {
  view?: View;
  positionId?: string;
}) {
  const organization = useOrganization();
  if (!organization.activeId || organization.transitioning)
    return <p>Consultando el contexto de la organización…</p>;
  return (
    <PpeFlow key={`${organization.activeId}:${view}:${positionId ?? ''}`}>
      <PpePage view={view} positionId={positionId} />
    </PpeFlow>
  );
}
function PpePage({ view, positionId }: { view: View; positionId?: string }) {
  const api = usePpeApi();
  return (
    <WorkspaceShell className="workforce-shell">
      <nav className={styles.nav} aria-label="Protección personal">
        <Link href="/app/ppe">Protección personal</Link>
        <Link href="/app/ppe/positions">Cargos</Link>
        <Link href="/app/ppe/people">Personas</Link>
        <Link href="/app/ppe/catalog">Catálogo</Link>
      </nav>
      {view === 'landing' ? (
        <Landing api={api} />
      ) : view === 'catalog' ? (
        <PpeCatalogExperience api={api} />
      ) : view === 'positions' ? (
        <PpePositionsExperience api={api} positionId={positionId} />
      ) : (
        <People api={api} />
      )}
    </WorkspaceShell>
  );
}
type Queue = {
  total: number;
  items: Array<{
    type: string;
    sourceId: string;
    title: string;
    summary: string;
    status: string;
    deepLink: string;
  }>;
};
function useAttention(api: PpeApi, status: string) {
  const filters = `module=PPE&status=${status}&pageSize=3`;
  return useQuery({
    queryKey: queryKeys.organization.workQueue(api.organizationId, filters),
    queryFn: ({ signal }) => api.request<Queue>(`/work-queue?${filters}`, { signal }),
  });
}
function Metric({
  title,
  value,
  pending,
  error,
  href,
  retry,
}: {
  title: string;
  value?: number;
  pending: boolean;
  error: boolean;
  href: string;
  retry(): void;
}) {
  return (
    <Card className={styles.metric}>
      {error ? (
        <>
          <p>No pudimos consultar este dato.</p>
          <button type="button" className="button secondary" onClick={retry}>
            Reintentar<span className="sr-only"> {title}</span>
          </button>
        </>
      ) : pending ? (
        <p>Consultando…</p>
      ) : value !== undefined ? (
        <strong>{value}</strong>
      ) : (
        <p>Dato no disponible</p>
      )}
      <Link href={href}>{title}</Link>
    </Card>
  );
}
function Landing({ api }: { api: PpeApi }) {
  const positions = usePpePositions(api);
  const replacements = useAttention(api, 'REPLACEMENT_DUE');
  const reviews = useAttention(api, 'REVIEW_REQUIRED');
  const attentionReady =
    !replacements.isFetching && !reviews.isFetching && replacements.isSuccess && reviews.isSuccess;
  return (
    <>
      <WorkspaceHeader
        eyebrow="Operación · Protección personal"
        title="Protección personal"
        description="Decide por cargo, entrega a cada persona y atiende lo que necesita seguimiento."
      />
      <div className={styles.metrics}>
        <Metric
          title="Cargos con riesgos registrados"
          value={
            positions.data?.filter((row) => row.isActive && row.riskContexts.length > 0).length
          }
          pending={positions.isPending || positions.isFetching}
          error={positions.isError}
          href="/app/ppe/positions"
          retry={() => void positions.refetch()}
        />
        <Metric
          title="Reemplazos requeridos"
          value={replacements.data?.total}
          pending={replacements.isPending || replacements.isFetching}
          error={replacements.isError}
          href="/app/work?module=PPE&status=REPLACEMENT_DUE"
          retry={() => void replacements.refetch()}
        />
        <Metric
          title="Condiciones por revisar"
          value={reviews.data?.total}
          pending={reviews.isPending || reviews.isFetching}
          error={reviews.isError}
          href="/app/work?module=PPE&status=REVIEW_REQUIRED"
          retry={() => void reviews.refetch()}
        />
      </div>
      <WorkspaceSection title="¿Qué necesitas hacer?">
        <div className={styles.grid}>
          <article className={styles.primary}>
            <h3>Revisar protección por cargo</h3>
            <p>Parte de los riesgos y revisa las decisiones registradas.</p>
            <Link className="button" href="/app/ppe/positions">
              Revisar protección por cargo
            </Link>
          </article>
          <Card className={styles.stack}>
            <h3>Atender a una persona</h3>
            <p>Consulta su protección y prepara una entrega pendiente.</p>
            <Link className="button secondary" href="/app/ppe/people">
              Buscar una persona
            </Link>
          </Card>
        </div>
      </WorkspaceSection>
      <WorkspaceSection
        title="Requiere atención"
        description="Una entrega puede requerir reemplazo y revisión; los contadores representan tipos de atención."
      >
        {attentionReady ? (
          <>
            {replacements.data.total === 0 && reviews.data.total === 0 ? (
              <p>Sin atención pendiente de EPP.</p>
            ) : (
              <ul className={styles.list}>
                {[...replacements.data.items, ...reviews.data.items].map((item) => (
                  <li key={`${item.type}:${item.sourceId}`} className={styles.row}>
                    <div>
                      <span
                        className={styles.badge}
                        data-tone={item.status === 'REVIEW_REQUIRED' ? 'warning' : 'danger'}
                      >
                        {item.status === 'REVIEW_REQUIRED'
                          ? 'Condición por revisar'
                          : 'Reemplazo requerido'}
                      </span>
                      <h3>{item.title}</h3>
                      <p>
                        {item.status === 'REVIEW_REQUIRED'
                          ? 'Revisa la última condición registrada.'
                          : 'Revisa el estado y la fecha prevista antes de actuar.'}
                      </p>
                    </div>
                    <Link className="button secondary" href={item.deepLink}>
                      Revisar entrega<span className="sr-only"> {item.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link className="button secondary" href="/app/work?module=PPE">
              Continuar en Cola de trabajo
            </Link>
          </>
        ) : replacements.isError || reviews.isError ? (
          <div role="alert">
            <p>No pudimos cargar la atención pendiente.</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                void replacements.refetch();
                void reviews.refetch();
              }}
            >
              Reintentar atención
            </button>
          </div>
        ) : (
          <p>Consultando atención…</p>
        )}
      </WorkspaceSection>
      <Card className={styles.stack}>
        <h2>Catálogo de la organización</h2>
        <p>Administra los elementos que el profesional puede elegir.</p>
        <Link className="button secondary" href="/app/ppe/catalog">
          Explorar catálogo
        </Link>
      </Card>
    </>
  );
}
function People({ api }: { api: PpeApi }) {
  const [worker, setWorker] = useState<WorkerChoice | null>(null);
  return (
    <>
      <WorkspaceHeader
        eyebrow="Protección personal"
        title="Atender a una persona"
        description="Consulta sus requisitos, entregas e historia. Recibir protección no requiere una cuenta de acceso."
      />
      <WorkspaceSection title="Personas de la organización">
        <PpeServerSelection<WorkerChoice>
          api={api}
          path="/workers"
          label="Buscar trabajador"
          selected={worker}
          onSelect={setWorker}
          name={(row) => row.displayName}
          detail={(row) =>
            `${row.status === 'ACTIVE' ? 'Activo' : 'Inactivo'} · ${row.position?.name ?? 'Sin cargo registrado'} · ${row.workCenter?.name ?? 'Sin centro registrado'}`
          }
        />
        {worker ? (
          <Link className="button" href={`/app/workers/${worker.id}#epp`}>
            Ver protección de {worker.displayName}
          </Link>
        ) : null}
      </WorkspaceSection>
    </>
  );
}
