'use client';

import { Card } from '@sst/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CATEGORY_LABELS,
  REVIEW_LABELS,
  REVIEW_ROLES,
  type CatalogItem,
  type PpeCategory,
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

export function PpeCatalogExperience({ api }: { api: PpeApi }) {
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  return (
    <>
      <WorkspaceHeader
        eyebrow="Protección personal"
        title="Catálogo de protección"
        description="Encuentra y revisa los elementos disponibles para las decisiones de tu organización."
        actions={
          REVIEW_ROLES.has(api.role) ? (
            <button type="button" className="button" onClick={() => setCreating(true)}>
              Agregar elemento
            </button>
          ) : null
        }
      />
      <WorkspaceSection
        title="Elementos registrados"
        description="La selección de un resultado abre su información. No asigna protección a ninguna persona."
      >
        <div className={styles.grid}>
          <label className="field">
            <span>Categoría</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Estado</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
            </select>
          </label>
        </div>
        <PpeServerSelection<CatalogItem>
          api={api}
          path="/ppe/catalog"
          filters={{ ...(category ? { category } : {}), ...(status ? { status } : {}) }}
          label="Buscar elemento"
          selected={selected}
          onSelect={setSelected}
          name={(item) => item.name}
          detail={(item) => <CatalogChoiceSummary item={item} />}
          actionLabel="Ver elemento"
        />
      </WorkspaceSection>
      {selected ? (
        <Card className={styles.stack}>
          <div className={styles.row}>
            <h2>{selected.name}</h2>
            <span className={styles.badge}>
              {selected.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p>{selected.description || 'Sin descripción registrada'}</p>
          <dl className={styles.facts}>
            <div>
              <dt>Categoría</dt>
              <dd>{CATEGORY_LABELS[selected.category]}</dd>
            </div>
            <div>
              <dt>Fabricante / modelo</dt>
              <dd>{selected.manufacturerModel || 'Sin registro'}</dd>
            </div>
            <div>
              <dt>Intervalo previsto</dt>
              <dd>
                {selected.defaultReplacementIntervalDays
                  ? `${selected.defaultReplacementIntervalDays} días · dato registrado`
                  : 'Sin intervalo registrado'}
              </dd>
            </div>
          </dl>
          <PpeReference item={selected} />
          <Link href="/app/ppe/positions" className="button secondary">
            Revisar protección por cargo
          </Link>
        </Card>
      ) : null}
      {creating ? <CatalogCreate api={api} onClose={() => setCreating(false)} /> : null}
    </>
  );
}

type CatalogForm = {
  name: string;
  category: PpeCategory;
  description: string;
  manufacturerModel: string;
  referenceStandard: string;
  referenceJurisdiction: string;
  referenceProvenance: string;
  referenceReviewStatus: NonNullable<CatalogItem['referenceReviewStatus']>;
  defaultReplacementIntervalDays: string;
};
function CatalogCreate({ api, onClose }: { api: PpeApi; onClose(): void }) {
  const form = useForm<CatalogForm>({
    defaultValues: {
      name: '',
      category: 'HEAD',
      description: '',
      manufacturerModel: '',
      referenceStandard: '',
      referenceJurisdiction: '',
      referenceProvenance: '',
      referenceReviewStatus: 'PENDING_PROFESSIONAL_REVIEW',
      defaultReplacementIntervalDays: '',
    },
  });
  const command = usePpeCommand(api, 'Elemento agregado al catálogo.', onClose);
  const reviewed = form.watch('referenceReviewStatus') === 'REVIEWED';
  return (
    <PpeDialog
      title="Nuevo elemento"
      onClose={() => {
        if (!command.isPending) onClose();
      }}
    >
      <p>
        Registra los datos disponibles; no se sugiere ningún intervalo ni referencia por defecto.
      </p>
      <form
        className={styles.stack}
        onSubmit={form.handleSubmit((values) =>
          command.run('/ppe/catalog', {
            name: values.name.trim(),
            category: values.category,
            referenceReviewStatus: values.referenceReviewStatus,
            ...Object.fromEntries(
              [
                'description',
                'manufacturerModel',
                'referenceStandard',
                'referenceJurisdiction',
                'referenceProvenance',
              ].flatMap((key) => {
                const value = values[key as keyof CatalogForm].trim();
                return value ? [[key, value]] : [];
              }),
            ),
            ...(values.defaultReplacementIntervalDays
              ? { defaultReplacementIntervalDays: Number(values.defaultReplacementIntervalDays) }
              : {}),
          }),
        )}
      >
        <label className="field">
          <span>Nombre del elemento</span>
          <input
            required
            minLength={2}
            maxLength={200}
            {...form.register('name', { required: true, minLength: 2, maxLength: 200 })}
          />
        </label>
        <label className="field">
          <span>Categoría de protección</span>
          <select {...form.register('category')}>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Descripción (opcional)</span>
          <textarea maxLength={2000} {...form.register('description')} />
        </label>
        <label className="field">
          <span>Fabricante / modelo (opcional)</span>
          <input maxLength={200} {...form.register('manufacturerModel')} />
        </label>
        <label className="field">
          <span>Referencia técnica {reviewed ? '(requerida)' : '(opcional)'}</span>
          <input
            required={reviewed}
            maxLength={300}
            {...form.register('referenceStandard', {
              validate: (value) =>
                !reviewed || Boolean(value.trim()) || 'Registra la referencia técnica.',
            })}
          />
          {form.formState.errors.referenceStandard ? (
            <span className="field-error">{form.formState.errors.referenceStandard.message}</span>
          ) : null}
        </label>
        <label className="field">
          <span>Jurisdicción / contexto (opcional)</span>
          <input maxLength={120} {...form.register('referenceJurisdiction')} />
        </label>
        <label className="field">
          <span>Proveniencia {reviewed ? '(requerida)' : '(opcional)'}</span>
          <textarea
            required={reviewed}
            maxLength={1000}
            {...form.register('referenceProvenance', {
              validate: (value) =>
                !reviewed || Boolean(value.trim()) || 'Registra la proveniencia verificable.',
            })}
          />
          {form.formState.errors.referenceProvenance ? (
            <span className="field-error">{form.formState.errors.referenceProvenance.message}</span>
          ) : null}
        </label>
        <label className="field">
          <span>Estado de revisión</span>
          <select {...form.register('referenceReviewStatus')}>
            {Object.entries(REVIEW_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Intervalo previsto (días, opcional)</span>
          <input
            type="number"
            min={1}
            max={3650}
            {...form.register('defaultReplacementIntervalDays')}
          />
          <small>
            Solo un intervalo definido profesionalmente. La ausencia de intervalo no crea una fecha
            prevista.
          </small>
        </label>
        <PpeCommandFeedback command={command} />
        <PpeSubmit command={command}>Agregar al catálogo</PpeSubmit>
      </form>
    </PpeDialog>
  );
}
