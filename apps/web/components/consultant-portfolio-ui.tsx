'use client';

import { ApiClientError } from '@sst/api-client';
import { Button, Card, StatusBadge } from '@sst/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  defaultPortfolioFilters,
  portfolioDueLabel,
  portfolioFilterQuery,
  portfolioRoleLabel,
  type PortfolioFilters,
} from '@/lib/portfolio-experience';
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

type OrganizationCard = {
  organization: { id: string; name: string; country: string; sector: string | null };
  currentRole: string;
  workCenterCount: number;
  needsAttention: boolean;
  needsAttentionCount: number;
  actionableWorkCount: number;
  overdueActionableWorkCount: number;
  activeSignalCount: number;
  evidencePackages: { draft: number; finalized: number; archived: number };
  recentIncidentCount: number | null;
  language: string;
};
type WorkItem = {
  type: string;
  sourceId: string;
  organizationId: string;
  organizationName: string;
  title: string;
  summary: string;
  status: string;
  priority: string;
  dueAt: string | null;
  dueState: string;
  assignee: { displayName: string } | null;
  deepLink: string;
};
type Signal = {
  id: string;
  organizationId: string;
  organizationName: string;
  title: string;
  explanation: string;
  ruleKey: string;
  ruleVersion: string;
  observedCount: number;
  threshold: number;
  windowStart: string;
  windowEnd: string;
  deepLink: string;
};
type Evidence = {
  id: string;
  organizationId: string;
  organizationName: string;
  title: string;
  scope: string;
  status: string;
  version: number;
  deepLink: string;
};
type PortfolioResponse = {
  summary: {
    authorizedOrganizations: number;
    visibleOrganizations: number;
    organizationsRequiringAttention: number;
    totalActionableWork: number;
    totalOverdueWork: number;
    openOperationalSignals: number;
    evidencePackagesRequiringWork: number;
    organizationSafetyScore: null;
  };
  organizations: OrganizationCard[];
  work: { items: WorkItem[]; total: number; boundedResult: true };
  signals: Signal[];
  evidence: Evidence[];
};
type ProviderStatus = {
  providerKey: string;
  mode: string;
  label: string;
  externalProcessing: boolean;
};
type Citation = {
  id: string;
  organizationId: string;
  organizationName: string;
  sourceType: string;
  label: string;
  deepLink: string;
};
type CopilotResponse = {
  status: string;
  summary: string;
  citations: Citation[];
  materialWriteExecuted: false;
  organizationAnchor: {
    required: true;
    organizationId: string;
    organizationName: string;
    role: string;
    deepLink: string;
  } | null;
};
type PortfolioView = 'attention' | 'organizations' | 'work' | 'signals' | 'evidence' | 'copilot';

const viewLabels: Record<PortfolioView, string> = {
  attention: 'Necesita atención',
  organizations: 'Organizaciones',
  work: 'Trabajo pendiente',
  signals: 'Señales',
  evidence: 'Evidencia',
  copilot: 'Preguntar / Operar',
};

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.payload.message;
  return 'No pudimos consultar el portafolio. Intenta nuevamente.';
}

export function ConsultantPortfolioWorkspace() {
  const auth = useAuth();
  const organization = useOrganization();
  const router = useRouter();
  const userId = auth.user?.id ?? 'unauthenticated';
  const filterForm = useForm<PortfolioFilters>({ defaultValues: defaultPortfolioFilters });
  const questionForm = useForm<{ content: string }>({
    defaultValues: { content: '¿Qué clientes necesitan atención hoy?' },
  });
  const [filters, setFilters] = useState(defaultPortfolioFilters);
  const [view, setView] = useState<PortfolioView>('attention');
  const [navigationTarget, setNavigationTarget] = useState('');
  const queryString = useMemo(() => portfolioFilterQuery(filters), [filters]);
  const portfolio = useQuery({
    queryKey: queryKeys.user.portfolio(userId, queryString),
    queryFn: ({ signal }) =>
      auth.request<PortfolioResponse>(`/portfolio?${queryString}`, { signal }),
    enabled: Boolean(auth.user && auth.accessToken),
  });
  const provider = useQuery({
    queryKey: queryKeys.user.portfolioProviderStatus(userId),
    queryFn: ({ signal }) => auth.request<ProviderStatus>('/portfolio/provider-status', { signal }),
    enabled: Boolean(auth.user && auth.accessToken),
  });
  const copilot = useMutation({
    mutationFn: (input: { content: string }) =>
      auth.request<CopilotResponse>('/portfolio/copilot/query', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });

  async function openCanonical(organizationId: string, deepLink: string) {
    setNavigationTarget(`${organizationId}:${deepLink}`);
    try {
      await organization.setActiveId(
        organizationId,
        'Contexto de organización establecido desde el portafolio.',
      );
      router.push(deepLink);
    } finally {
      setNavigationTarget('');
    }
  }

  const organizations = portfolio.data?.organizations ?? [];
  const attentionOrganizations = organizations.filter(({ needsAttention }) => needsAttention);
  return (
    <WorkspaceShell className="portfolio-workspace">
      <WorkspaceHeader
        eyebrow="Vista multi-organización autorizada"
        title="Portafolio operativo"
        description="Revisa hechos operativos de las organizaciones donde tu membresía está activa. Cada acceso, fuente y rol se valida por organización."
        context={
          <ContextSummary>
            <span>
              {portfolio.data?.summary.authorizedOrganizations ?? 0} organizaciones autorizadas
            </span>
            <span>Sin puntuación de seguridad o cumplimiento</span>
            <span>{provider.data?.label ?? 'Consultando estado del procesamiento…'}</span>
          </ContextSummary>
        }
      />
      <form
        className="portfolio-filters focus-dim"
        aria-label="Filtros del portafolio"
        onSubmit={filterForm.handleSubmit(setFilters)}
      >
        <label className="field">
          <span>Buscar organización</span>
          <input placeholder="Nombre, país, sector o rol" {...filterForm.register('search')} />
        </label>
        <label className="field">
          <span>Atención</span>
          <select {...filterForm.register('attention')}>
            <option value="ALL">Todas</option>
            <option value="NEEDS_ATTENTION">Necesita atención</option>
            <option value="NO_CRITICAL_PENDING">Sin pendientes críticos</option>
          </select>
        </label>
        <label className="field">
          <span>Vencimiento</span>
          <select {...filterForm.register('dueState')}>
            <option value="ALL">Todos</option>
            <option value="OVERDUE">Vencidos</option>
            <option value="DUE_SOON">Próximos a vencer</option>
            <option value="FUTURE">Programados</option>
            <option value="NO_DUE">Sin fecha</option>
          </select>
        </label>
        <Button type="submit">Aplicar filtros</Button>
        <Button
          type="button"
          className="secondary"
          onClick={() => {
            filterForm.reset(defaultPortfolioFilters);
            setFilters(defaultPortfolioFilters);
          }}
        >
          Limpiar
        </Button>
      </form>
      <nav className="portfolio-tabs focus-dim" aria-label="Secciones del portafolio">
        {(Object.keys(viewLabels) as PortfolioView[]).map((key) => (
          <button
            type="button"
            key={key}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => setView(key)}
          >
            {viewLabels[key]}
          </button>
        ))}
      </nav>
      {portfolio.isLoading ? <p role="status">Preparando tu portafolio autorizado…</p> : null}
      {portfolio.error ? (
        <p role="alert" className="form-error">
          {errorMessage(portfolio.error)}
        </p>
      ) : null}
      <WorkspaceMain>
        {view === 'attention' ? (
          <WorkspaceSection
            eyebrow="Prioridad factual"
            title="Necesita atención"
            description="Ordenado por trabajo vencido, prioridad, fecha y señales accionables; no es un puntaje de empresa."
          >
            <div className="metric-grid portfolio-summary">
              <Card>
                <span>Organizaciones</span>
                <strong>{portfolio.data?.summary.organizationsRequiringAttention ?? 0}</strong>
              </Card>
              <Card>
                <span>Trabajo vencido</span>
                <strong>{portfolio.data?.summary.totalOverdueWork ?? 0}</strong>
              </Card>
              <Card>
                <span>Señales activas</span>
                <strong>{portfolio.data?.summary.openOperationalSignals ?? 0}</strong>
              </Card>
              <Card>
                <span>Paquetes pendientes</span>
                <strong>{portfolio.data?.summary.evidencePackagesRequiringWork ?? 0}</strong>
              </Card>
            </div>
            <div className="portfolio-card-grid">
              {attentionOrganizations.map((card) => (
                <OrganizationSummaryCard
                  card={card}
                  key={card.organization.id}
                  pending={navigationTarget.startsWith(card.organization.id)}
                  onOpen={() => void openCanonical(card.organization.id, '/app')}
                />
              ))}
            </div>
            {portfolio.data && attentionOrganizations.length === 0 ? (
              <p className="portfolio-empty">
                Sin pendientes críticos registrados en las organizaciones visibles.
              </p>
            ) : null}
          </WorkspaceSection>
        ) : null}
        {view === 'organizations' ? (
          <WorkspaceSection
            title="Clientes / Organizaciones"
            description="La función y los datos se resuelven por cada membresía activa."
          >
            <div className="portfolio-card-grid">
              {organizations.map((card) => (
                <OrganizationSummaryCard
                  card={card}
                  key={card.organization.id}
                  pending={navigationTarget.startsWith(card.organization.id)}
                  onOpen={() => void openCanonical(card.organization.id, '/app')}
                />
              ))}
            </div>
          </WorkspaceSection>
        ) : null}
        {view === 'work' ? (
          <WorkspaceSection
            title="Trabajo pendiente"
            description="Elementos canónicos; su ciclo de vida continúa en el espacio de la organización."
          >
            <div className="portfolio-record-list">
              {portfolio.data?.work.items.map((item) => (
                <Card key={`${item.type}:${item.sourceId}`}>
                  <div className="record-heading">
                    <div>
                      <p className="eyebrow">{item.organizationName}</p>
                      <h3>{item.title}</h3>
                    </div>
                    <StatusBadge>{portfolioDueLabel(item.dueState)}</StatusBadge>
                  </div>
                  <p>{item.summary}</p>
                  <p className="muted">
                    Prioridad {item.priority} ·{' '}
                    {item.assignee?.displayName ?? 'Sin responsable asignado'}
                  </p>
                  <Button
                    type="button"
                    disabled={Boolean(navigationTarget)}
                    onClick={() => void openCanonical(item.organizationId, item.deepLink)}
                  >
                    Abrir en organización
                  </Button>
                </Card>
              ))}
            </div>
          </WorkspaceSection>
        ) : null}
        {view === 'signals' ? (
          <WorkspaceSection
            title="Señales operativas"
            description="Señales canónicas con regla, versión, ventana y fuente preservadas."
          >
            <div className="portfolio-record-list">
              {portfolio.data?.signals.map((signal) => (
                <Card key={signal.id}>
                  <p className="eyebrow">{signal.organizationName}</p>
                  <h3>{signal.title}</h3>
                  <p>{signal.explanation}</p>
                  <p className="muted">
                    {signal.ruleKey} v{signal.ruleVersion} · {signal.observedCount}/
                    {signal.threshold} · {new Date(signal.windowStart).toLocaleDateString('es-EC')}–
                    {new Date(signal.windowEnd).toLocaleDateString('es-EC')}
                  </p>
                  <Button
                    type="button"
                    disabled={Boolean(navigationTarget)}
                    onClick={() => void openCanonical(signal.organizationId, signal.deepLink)}
                  >
                    Abrir señal
                  </Button>
                </Card>
              ))}
            </div>
          </WorkspaceSection>
        ) : null}
        {view === 'evidence' ? (
          <WorkspaceSection
            title="Estado de evidencia"
            description="El portafolio muestra estado y alcance; el manifiesto se consulta dentro de su organización."
          >
            <div className="portfolio-record-list">
              {portfolio.data?.evidence.map((item) => (
                <Card key={item.id}>
                  <div className="record-heading">
                    <div>
                      <p className="eyebrow">{item.organizationName}</p>
                      <h3>{item.title}</h3>
                    </div>
                    <StatusBadge>{item.status}</StatusBadge>
                  </div>
                  <p>{item.scope}</p>
                  <p className="muted">Versión {item.version} · Sin afirmación de certificación.</p>
                  <Button
                    type="button"
                    disabled={Boolean(navigationTarget)}
                    onClick={() => void openCanonical(item.organizationId, item.deepLink)}
                  >
                    Abrir paquete
                  </Button>
                </Card>
              ))}
            </div>
          </WorkspaceSection>
        ) : null}
        {view === 'copilot' ? (
          <WorkspaceSection
            eyebrow="PORTFOLIO_READ_ONLY"
            title="Preguntar / Operar"
            description="Consulta estructurada sobre fuentes autorizadas. El procesamiento local no decide cumplimiento, riesgo ni causa raíz."
          >
            <Card className="portfolio-copilot">
              <p>
                <strong>{provider.data?.label ?? 'Procesamiento local controlado'}</strong>
              </p>
              <form onSubmit={questionForm.handleSubmit((value) => copilot.mutate(value))}>
                <label className="field">
                  <span>Pregunta sobre tu portafolio</span>
                  <textarea rows={4} {...questionForm.register('content', { required: true })} />
                </label>
                <Button type="submit" disabled={copilot.isPending}>
                  {copilot.isPending ? 'Consultando…' : 'Consultar'}
                </Button>
              </form>
              {copilot.error ? (
                <p className="form-error" role="alert">
                  {errorMessage(copilot.error)}
                </p>
              ) : null}
              {copilot.data ? (
                <div className="portfolio-answer" aria-live="polite">
                  <StatusBadge>{copilot.data.status}</StatusBadge>
                  <p>{copilot.data.summary}</p>
                  {copilot.data.organizationAnchor ? (
                    <div className="portfolio-anchor">
                      <strong>
                        Contexto requerido: {copilot.data.organizationAnchor.organizationName}
                      </strong>
                      <span>
                        La acción no se ha creado. Primero cambiaremos al contexto indicado.
                      </span>
                      <Button
                        type="button"
                        disabled={Boolean(navigationTarget)}
                        onClick={() =>
                          void openCanonical(
                            copilot.data!.organizationAnchor!.organizationId,
                            copilot.data!.organizationAnchor!.deepLink,
                          )
                        }
                      >
                        Establecer contexto y continuar
                      </Button>
                    </div>
                  ) : null}
                  {copilot.data.citations.length ? <h3>Fuentes</h3> : null}
                  <ul className="portfolio-citations">
                    {copilot.data.citations.map((citation) => (
                      <li key={citation.id}>
                        <button
                          type="button"
                          disabled={Boolean(navigationTarget)}
                          onClick={() =>
                            void openCanonical(citation.organizationId, citation.deepLink)
                          }
                        >
                          <strong>{citation.organizationName}</strong>
                          <span>{citation.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          </WorkspaceSection>
        ) : null}
      </WorkspaceMain>
    </WorkspaceShell>
  );
}

function OrganizationSummaryCard({
  card,
  pending,
  onOpen,
}: {
  card: OrganizationCard;
  pending: boolean;
  onOpen(): void;
}) {
  return (
    <Card className="portfolio-organization-card">
      <div className="record-heading">
        <div>
          <p className="eyebrow">{portfolioRoleLabel(card.currentRole)}</p>
          <h3>{card.organization.name}</h3>
        </div>
        <StatusBadge>{card.language}</StatusBadge>
      </div>
      <p>
        {card.organization.country}
        {card.organization.sector ? ` · ${card.organization.sector}` : ''}
      </p>
      <dl className="metric-list">
        <div>
          <dt>Vencidos</dt>
          <dd>{card.overdueActionableWorkCount}</dd>
        </div>
        <div>
          <dt>Señales</dt>
          <dd>{card.activeSignalCount}</dd>
        </div>
        <div>
          <dt>Paquetes en borrador</dt>
          <dd>{card.evidencePackages.draft}</dd>
        </div>
        <div>
          <dt>Centros activos</dt>
          <dd>{card.workCenterCount}</dd>
        </div>
      </dl>
      <Button type="button" disabled={pending} onClick={onOpen}>
        {pending ? 'Estableciendo contexto…' : 'Entrar a la organización'}
      </Button>
    </Card>
  );
}
