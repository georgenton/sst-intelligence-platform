'use client';

import type { PositionRiskCategory } from '@sst/contracts';
import { Card } from '@sst/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import {
  CATEGORY_LABELS,
  REVIEW_ROLES,
  WRITE_ROLES,
  RISK_LABELS,
  ppeDate,
  ppeScope,
  type CatalogItem,
  type PpeCategory,
  type Position,
  type PositionRequirement,
  type WorkerChoice,
} from '@/lib/ppe-presentation';
import { WorkspaceHeader, WorkspaceSection } from './workspace';
import {
  CatalogChoiceSummary,
  PpeCommandFeedback,
  PpeDialog,
  PpeReference,
  PpeSubmit,
  usePpeCommand,
  type PpeApi,
} from './ppe-experience-ui';
import { PpeServerSelection } from './ppe-server-selection';
import styles from './ppe.module.css';

const PPE_CATEGORY_BY_POSITION_RISK: Record<PositionRiskCategory, readonly PpeCategory[]> = {
  ELECTRICAL: ['HAND_ARM', 'FOOT', 'HEAD'],
  ARC_FLASH: ['EYE_FACE', 'BODY', 'HAND_ARM', 'HEAD'],
  PROJECTION: ['EYE_FACE'],
  MECHANICAL: ['HAND_ARM', 'FOOT', 'HEAD'],
  ERGONOMIC: [],
  CHEMICAL: ['EYE_FACE', 'RESPIRATORY', 'HAND_ARM', 'BODY'],
  BIOLOGICAL: ['EYE_FACE', 'RESPIRATORY', 'HAND_ARM', 'BODY'],
  PHYSICAL: ['HEARING', 'HEAD', 'BODY'],
  OTHER: [],
};

function suggestPpeCategories(risks: readonly PositionRiskCategory[]) {
  return [...new Set(risks.flatMap((risk) => PPE_CATEGORY_BY_POSITION_RISK[risk]))].sort();
}

export function usePpePositions(api: PpeApi) {
  return useQuery({
    queryKey: queryKeys.organization.positions(api.organizationId),
    queryFn: ({ signal }) => api.request<Position[]>('/workers/positions', { signal }),
  });
}
export function usePositionRequirements(api: PpeApi) {
  return useQuery({
    queryKey: queryKeys.organization.positionPpeRequirements(api.organizationId),
    queryFn: ({ signal }) =>
      api.request<PositionRequirement[]>('/ppe/position-requirements', { signal }),
  });
}
export function PpePositionsExperience({ api, positionId }: { api: PpeApi; positionId?: string }) {
  const positions = usePpePositions(api);
  const requirements = usePositionRequirements(api);
  const [addRisk, setAddRisk] = useState(false);
  const [selection, setSelection] = useState<{
    risk: Position['riskContexts'][number];
    category: PpeCategory;
  } | null>(null);
  const [apply, setApply] = useState<PositionRequirement | null>(null);
  const position = positions.data?.find((item) => item.id === positionId);
  const canReview = REVIEW_ROLES.has(api.role);
  const active = positions.data?.filter((item) => item.isActive);
  if (positions.isPending) return <p>Consultando cargos y riesgos…</p>;
  if (positions.isError)
    return (
      <div role="alert">
        <p>No pudimos cargar los cargos.</p>
        <button type="button" className="button secondary" onClick={() => void positions.refetch()}>
          Reintentar
        </button>
      </div>
    );
  if (positionId && !position)
    return (
      <Card>
        <h1>Cargo no disponible</h1>
        <p>Revisa los cargos de esta organización.</p>
        <Link href="/app/ppe/positions">Volver a cargos</Link>
      </Card>
    );
  return (
    <>
      <WorkspaceHeader
        eyebrow="Protección personal · Cargo → riesgo → decisión"
        title={position ? position.name : 'Cargos y riesgos'}
        description={
          position
            ? 'Revisa el contexto registrado antes de elegir protección.'
            : 'Parte de los riesgos y revisa las decisiones de protección registradas.'
        }
        actions={
          position && canReview && position.isActive ? (
            <button type="button" className="button secondary" onClick={() => setAddRisk(true)}>
              Registrar otro riesgo
            </button>
          ) : (
            <Link href="/app/workers" className="button secondary">
              Administrar cargos y personas
            </Link>
          )
        }
      />
      {!position ? (
        <WorkspaceSection title="Cargos activos">
          {active?.length ? (
            <div className={styles.grid}>
              {active.map((item) => (
                <Card key={item.id} className={styles.stack}>
                  <h3>{item.name}</h3>
                  <p>
                    {item._count.workers} personas registradas · {item.riskContexts.length} riesgos
                  </p>
                  {requirements.data ? (
                    <p>
                      {requirements.data.filter((row) => row.position.id === item.id).length}{' '}
                      decisiones de protección
                    </p>
                  ) : (
                    <p>Decisiones: {requirements.isError ? 'no disponibles' : 'consultando…'}</p>
                  )}
                  <Link className="button secondary" href={`/app/ppe/positions/${item.id}`}>
                    Revisar cargo<span className="sr-only"> {item.name}</span>
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <Card className={styles.stack}>
              <h3>Todavía no hay cargos activos</h3>
              <p>
                Registra un cargo para reunir sus riesgos y las decisiones que aplicarás a cada
                persona.
              </p>
              <Link className="button" href="/app/workers">
                Ir a registro de cargos
              </Link>
            </Card>
          )}
        </WorkspaceSection>
      ) : (
        <>
          <div className={styles.context}>
            <strong>{position.name}</strong>
            <p>
              {position._count.workers} personas registradas · {position.riskContexts.length}{' '}
              riesgos registrados
            </p>
            {!position.isActive ? (
              <p>Cargo inactivo. Se conserva su información registrada.</p>
            ) : null}
          </div>
          <WorkspaceSection
            title="Riesgos y protecciones a considerar"
            description="El mapeo determinista propone categorías. Una categoría sugerida todavía no es un requisito."
          >
            {position.riskContexts.length ? (
              <div className={styles.grid}>
                {position.riskContexts.map((risk) => {
                  // The existing pure contract is shared with the API. Catalog items are
                  // searched separately; the legacy unbounded candidate catalog is unused.
                  const categories = suggestPpeCategories([risk.category]) as PpeCategory[];
                  return (
                    <article key={risk.id} className={styles.candidate}>
                      <div>
                        <span className={styles.badge}>Riesgo registrado</span>
                        <h3>{RISK_LABELS[risk.category]}</h3>
                      </div>
                      <p>{risk.description}</p>
                      {categories.length ? (
                        <>
                          <h4>Protecciones a considerar</h4>
                          <div className={styles.actions}>
                            {categories.map((category) => (
                              <button
                                key={category}
                                type="button"
                                className="button secondary"
                                disabled={!canReview || !position.isActive}
                                onClick={() => setSelection({ risk, category })}
                              >
                                {CATEGORY_LABELS[category]}
                                <span className="sr-only"> para {RISK_LABELS[risk.category]}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <p>Este riesgo no tiene categorías sugeridas en el mapeo actual.</p>
                          <Link href="/app/ppe/catalog">Consultar catálogo</Link>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <Card className={styles.stack}>
                <p>Aún no hay riesgos registrados para este cargo.</p>
                {canReview && position.isActive ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setAddRisk(true)}
                  >
                    Registrar primer riesgo
                  </button>
                ) : null}
              </Card>
            )}
          </WorkspaceSection>
          <WorkspaceSection
            title="Decisiones registradas"
            description="Son selecciones humanas revisables; no representan un porcentaje de cumplimiento."
          >
            {requirements.isPending ? (
              <p>Consultando decisiones…</p>
            ) : requirements.isError ? (
              <div role="alert">
                <p>No pudimos cargar las decisiones.</p>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => void requirements.refetch()}
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <div className={styles.stack}>
                {requirements.data
                  ?.filter((row) => row.position.id === position.id)
                  .map((row) => (
                    <Card key={row.id} className={styles.stack}>
                      <PositionRequirementSummary requirement={row} />
                      <PpeReference item={row.ppeCatalogItem} />
                      {WRITE_ROLES.has(api.role) && position.isActive ? (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => setApply(row)}
                        >
                          Aplicar a una persona
                          <span className="sr-only">: {row.ppeCatalogItem.name}</span>
                        </button>
                      ) : null}
                    </Card>
                  ))}
                {!requirements.data?.some((row) => row.position.id === position.id) ? (
                  <p>Todavía no hay decisiones registradas para este cargo.</p>
                ) : null}
              </div>
            )}
          </WorkspaceSection>
        </>
      )}
      {position && addRisk ? (
        <AddPositionRisk api={api} position={position} onClose={() => setAddRisk(false)} />
      ) : null}
      {position && selection ? (
        <ProfessionalSelection
          api={api}
          position={position}
          {...selection}
          onClose={() => setSelection(null)}
        />
      ) : null}
      {apply ? (
        <ApplyPositionRequirement api={api} requirement={apply} onClose={() => setApply(null)} />
      ) : null}
    </>
  );
}

export function PositionRequirementSummary({ requirement }: { requirement: PositionRequirement }) {
  return (
    <>
      <div className={styles.row}>
        <h3>{requirement.ppeCatalogItem.name}</h3>
        <span className={styles.badge}>
          {requirement.decision === 'REQUIRED_INTERNALLY'
            ? 'Requisito interno'
            : 'Selección profesional'}
        </span>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Cargo / riesgo</dt>
          <dd>
            {requirement.position.name} ·{' '}
            {requirement.riskContext
              ? RISK_LABELS[requirement.riskContext.category]
              : 'Sin riesgo vinculado'}
          </dd>
        </div>
        <div>
          <dt>Alcance</dt>
          <dd>{ppeScope(requirement)}</dd>
        </div>
        <div>
          <dt>Seleccionado por</dt>
          <dd>{requirement.selectedBy?.displayName || 'Sin registro'}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{ppeDate(requirement.createdAt)}</dd>
        </div>
      </dl>
      <p>
        <strong>Motivo: </strong>
        {requirement.reason}
      </p>
    </>
  );
}
function AddPositionRisk({
  api,
  position,
  onClose,
}: {
  api: PpeApi;
  position: Position;
  onClose(): void;
}) {
  const form = useForm<{
    category: PositionRiskCategory | '';
    description: string;
    provenance: string;
  }>({ defaultValues: { category: '', description: '', provenance: '' } });
  const command = usePpeCommand(
    api,
    'Riesgo registrado. Revisa las protecciones a considerar.',
    onClose,
  );
  return (
    <PpeDialog
      title="Registrar un riesgo"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <p>
        <strong>Cargo: {position.name}</strong>
      </p>
      <p>Describe el contexto registrado. Esta acción no selecciona EPP automáticamente.</p>
      <form
        className={styles.stack}
        onSubmit={form.handleSubmit((values) =>
          command.run(`/workers/positions/${position.id}/risks`, {
            category: values.category,
            description: values.description.trim(),
            ...(values.provenance.trim() ? { provenance: values.provenance.trim() } : {}),
          }),
        )}
      >
        <label className="field">
          <span>Categoría del riesgo</span>
          <select required {...form.register('category', { required: true })}>
            <option value="">Selecciona una categoría</option>
            {Object.entries(RISK_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Descripción del riesgo</span>
          <textarea
            required
            minLength={3}
            maxLength={2000}
            {...form.register('description', { required: true, minLength: 3 })}
          />
        </label>
        <label className="field">
          <span>Proveniencia (opcional)</span>
          <textarea maxLength={1000} {...form.register('provenance')} />
        </label>
        <PpeCommandFeedback command={command} />
        <PpeSubmit command={command}>Registrar y revisar contexto</PpeSubmit>
      </form>
    </PpeDialog>
  );
}

function ProfessionalSelection({
  api,
  position,
  risk,
  category,
  onClose,
}: {
  api: PpeApi;
  position: Position;
  risk: Position['riskContexts'][number];
  category: PpeCategory;
  onClose(): void;
}) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [review, setReview] = useState(false);
  const form = useForm<{
    decision: PositionRequirement['decision'];
    reason: string;
    workCenterId: string;
    workAreaId: string;
  }>({
    defaultValues: {
      decision: 'SELECTED_BY_PROFESSIONAL',
      reason: '',
      workCenterId: '',
      workAreaId: '',
    },
  });
  const centerId = form.watch('workCenterId');
  const centers = useQuery({
    queryKey: queryKeys.organization.workCenters(api.organizationId),
    queryFn: ({ signal }) =>
      api.request<Array<{ id: string; name: string; isActive: boolean }>>(
        `/organizations/${api.organizationId}/work-centers`,
        { signal },
      ),
  });
  const areas = useQuery({
    queryKey: queryKeys.organization.workAreas(api.organizationId),
    queryFn: ({ signal }) =>
      api.request<Array<{ id: string; name: string; workCenterId: string }>>(
        '/workers/work-areas',
        { signal },
      ),
  });
  const command = usePpeCommand(api, 'Selección profesional registrada.', onClose);
  return (
    <PpeDialog
      title={review ? 'Selección profesional' : 'Protecciones a considerar'}
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <div className={styles.context}>
        <strong>
          {position.name} · {RISK_LABELS[risk.category]}
        </strong>
        <p>{risk.description}</p>
        <p>Categoría a considerar: {CATEGORY_LABELS[category]}</p>
      </div>
      {!review ? (
        <>
          <PpeServerSelection<CatalogItem>
            api={api}
            path="/ppe/catalog"
            filters={{ status: 'ACTIVE', category }}
            label="Buscar elemento"
            selected={item}
            onSelect={setItem}
            name={(row) => row.name}
            detail={(row) => <CatalogChoiceSummary item={row} />}
          />
          <button type="button" className="button" disabled={!item} onClick={() => setReview(true)}>
            Seleccionar profesionalmente
          </button>
          <Link href="/app/ppe/catalog">Revisar catálogo y alta de elementos</Link>
        </>
      ) : item ? (
        <form
          className={styles.stack}
          onSubmit={form.handleSubmit((values) =>
            command.run('/ppe/position-requirements', {
              positionId: position.id,
              riskContextId: risk.id,
              ppeCatalogItemId: item.id,
              decision: values.decision,
              reason: values.reason.trim(),
              ...(values.workCenterId ? { workCenterId: values.workCenterId } : {}),
              ...(values.workAreaId ? { workAreaId: values.workAreaId } : {}),
            }),
          )}
        >
          <div className={styles.selected}>
            <strong>Elemento: {item.name}</strong>
            <CatalogChoiceSummary item={item} />
            <button type="button" className="button secondary" onClick={() => setReview(false)}>
              Revisar elemento elegido
            </button>
          </div>
          <PpeReference item={item} />
          <label className="field">
            <span>Tipo de decisión</span>
            <select {...form.register('decision')}>
              <option value="SELECTED_BY_PROFESSIONAL">Selección profesional</option>
              <option value="REQUIRED_INTERNALLY">Requisito interno</option>
            </select>
          </label>
          <label className="field">
            <span>Alcance de la selección</span>
            <select
              disabled={centers.isPending || centers.isError}
              {...form.register('workCenterId', {
                onChange: () => form.setValue('workAreaId', ''),
              })}
            >
              <option value="">Organización</option>
              {centers.data
                ?.filter((row) => row.isActive)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Área (opcional)</span>
            <select
              disabled={!centerId || areas.isPending || areas.isError}
              {...form.register('workAreaId')}
            >
              <option value="">Sin restricción de área</option>
              {areas.data
                ?.filter((row) => row.workCenterId === centerId)
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
          {centers.isError || areas.isError ? (
            <div role="alert">
              <p>No pudimos cargar los alcances. Actualiza antes de guardar.</p>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  void centers.refetch();
                  void areas.refetch();
                }}
              >
                Reintentar alcances
              </button>
            </div>
          ) : null}
          <label className="field">
            <span>Motivo profesional</span>
            <textarea
              required
              minLength={3}
              maxLength={2000}
              {...form.register('reason', { required: true, minLength: 3 })}
            />
          </label>
          <p>
            La decisión se guarda con tu autoría y fecha. No representa una certificación del
            elemento.
          </p>
          <PpeCommandFeedback command={command} />
          {!centers.isError && !areas.isError && !centers.isPending && !areas.isPending ? (
            <PpeSubmit command={command}>Registrar selección</PpeSubmit>
          ) : null}
        </form>
      ) : null}
    </PpeDialog>
  );
}

export function ApplyPositionRequirement({
  api,
  requirement,
  worker: fixedWorker,
  onClose,
  onApplied,
}: {
  api: PpeApi;
  requirement: PositionRequirement;
  worker?: WorkerChoice;
  onClose(): void;
  onApplied?(): void;
}) {
  const router = useRouter();
  const [worker, setWorker] = useState<WorkerChoice | null>(fixedWorker ?? null);
  const form = useForm<{ reason: string }>({ defaultValues: { reason: '' } });
  const command = usePpeCommand(api, 'Requisito registrado para la persona seleccionada.', () => {
    if (onApplied) onApplied();
    else if (worker) router.push(`/app/workers/${worker.id}#epp`);
    onClose();
  });
  return (
    <PpeDialog
      title="Aplicar requisito a una persona"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <PositionRequirementSummary requirement={requirement} />
      {fixedWorker ? (
        <div className={styles.selected}>
          <strong>Persona: {fixedWorker.displayName}</strong>
        </div>
      ) : (
        <PpeServerSelection<WorkerChoice>
          api={api}
          path="/workers"
          filters={{
            status: 'ACTIVE',
            positionId: requirement.position.id,
            ...(requirement.workCenter ? { workCenterId: requirement.workCenter.id } : {}),
            ...(requirement.workArea ? { workAreaId: requirement.workArea.id } : {}),
          }}
          label="Buscar trabajador"
          selected={worker}
          onSelect={setWorker}
          name={(row) => row.displayName}
          detail={(row) =>
            [row.position?.name, row.workCenter?.name, row.workArea?.name]
              .filter(Boolean)
              .join(' · ')
          }
        />
      )}
      <p>
        Se aplica a una sola persona compatible con el cargo y alcance. No necesita una cuenta de
        acceso.
      </p>
      <form
        className={styles.stack}
        onSubmit={form.handleSubmit((values) => {
          if (worker)
            command.run('/ppe/requirements', {
              workerId: worker.id,
              ppeCatalogItemId: requirement.ppeCatalogItem.id,
              positionRequirementId: requirement.id,
              reason: values.reason.trim(),
            });
        })}
      >
        <label className="field" htmlFor="ppe-apply-requirement-reason">
          <span>Motivo de la asignación individual</span>
          <textarea
            id="ppe-apply-requirement-reason"
            required
            minLength={3}
            maxLength={2000}
            {...form.register('reason', { required: true, minLength: 3 })}
          />
        </label>
        <PpeCommandFeedback command={command} />
        {worker ? (
          <PpeSubmit command={command}>Añadir requisito a esta persona</PpeSubmit>
        ) : (
          <p>Elige explícitamente una persona para continuar.</p>
        )}
      </form>
    </PpeDialog>
  );
}
