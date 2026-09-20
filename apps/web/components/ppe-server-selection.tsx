'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { usePpeAnnouncement, type PpeApi } from './ppe-experience-ui';
import styles from './ppe.module.css';

type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
type Props<T extends { id: string }> = {
  api: PpeApi;
  path: string;
  filters?: Record<string, string>;
  label: string;
  selected: T | null;
  onSelect(item: T | null): void;
  name(item: T): string;
  detail?(item: T): ReactNode;
  actionLabel?: string;
  disabled?: boolean;
};
export function PpeServerSelection<T extends { id: string }>(props: Props<T>) {
  return (
    <Selection
      key={`${props.api.organizationId}:${props.path}:${JSON.stringify(props.filters ?? {})}`}
      {...props}
    />
  );
}
function Selection<T extends { id: string }>({
  api,
  path,
  filters = {},
  label,
  selected,
  onSelect,
  name,
  detail,
  actionLabel = 'Seleccionar',
  disabled = false,
}: Props<T>) {
  const id = useId();
  const announce = usePpeAnnouncement();
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    ...filters,
    page: String(page),
    pageSize: '20',
    ...(search ? { search } : {}),
  }).toString();
  const results = useQuery({
    queryKey: [...queryKeys.organization.scope(api.organizationId), 'ppe-selection', path, params],
    queryFn: ({ signal }) => api.request<Page<T>>(`${path}?${params}`, { signal }),
    retry: 1,
  });
  useEffect(() => {
    if (results.data && !results.isFetching)
      announce(`${results.data.items.length} resultados de ${results.data.total}.`);
  }, [results.data, results.isFetching, announce]);
  const searchNow = () => {
    setSearch(draft.trim());
    setPage(1);
    if (search === draft.trim() && page === 1) void results.refetch();
  };
  const total = results.data?.total;
  return (
    <section className={styles.stack} aria-label={label}>
      {selected ? (
        <div className={styles.selected}>
          <strong>Selección actual: {name(selected)}</strong>
          {detail ? <div>{detail(selected)}</div> : null}
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              onSelect(null);
              announce('Selección retirada.');
            }}
          >
            Cambiar selección
          </button>
        </div>
      ) : null}
      <div className={styles.search}>
        <label className="field" htmlFor={id}>
          <span>{label}</span>
          <input
            id={id}
            type="search"
            value={draft}
            maxLength={120}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                searchNow();
              }
            }}
          />
        </label>
        <button
          className="button secondary"
          type="button"
          onClick={searchNow}
          disabled={results.isFetching}
        >
          Buscar
        </button>
      </div>
      {results.isFetching ? <p>Consultando resultados…</p> : null}
      {results.isError ? (
        <div role="alert">
          <p>No pudimos cargar los resultados. Tu selección se conserva.</p>
          <button type="button" className="button secondary" onClick={() => void results.refetch()}>
            Reintentar búsqueda
          </button>
        </div>
      ) : null}
      {!results.isFetching && !results.isError && results.data ? (
        <>
          {results.data.items.length ? (
            <ul className={styles.list}>
              {results.data.items.map((item) => (
                <li key={item.id} className={styles.row}>
                  <div>
                    <strong>{name(item)}</strong>
                    {detail ? <div>{detail(item)}</div> : null}
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={disabled}
                    aria-pressed={selected?.id === item.id}
                    onClick={() => {
                      onSelect(item);
                      announce(`Seleccionado: ${name(item)}.`);
                    }}
                  >
                    {actionLabel}
                    <span className="sr-only"> {name(item)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay coincidencias. Prueba otra búsqueda o revisa los filtros.</p>
          )}
          <p>
            Mostrando {results.data.items.length ? (page - 1) * 20 + 1 : 0}–
            {(page - 1) * 20 + results.data.items.length} de {total}
          </p>
          <nav className={styles.actions} aria-label={`Paginación: ${label}`}>
            <button
              type="button"
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {Math.max(1, Math.ceil((total ?? 0) / 20))}
            </span>
            <button
              type="button"
              className="button secondary"
              disabled={page * 20 >= (total ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </button>
          </nav>
        </>
      ) : null}
    </section>
  );
}
