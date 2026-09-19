'use client';

import { ApiClientError } from '@sst/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { queryKeys } from '@/lib/query-keys';
import { CATEGORY_LABELS, REVIEW_LABELS, type CatalogItem } from '@/lib/ppe-presentation';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';
import { PlanDialog } from './operational-plan-surfaces';
import { useRealRequestFeedback } from './use-real-request-feedback';
import styles from './ppe.module.css';

const Live = createContext<{
  message: string;
  announce(message: string): void;
  setModal(open: boolean): void;
} | null>(null);
export function PpeFlow({ children }: PropsWithChildren) {
  const [message, announce] = useState('');
  const [modal, setModal] = useState(false);
  const value = useMemo(() => ({ message, announce, setModal }), [message]);
  return (
    <Live.Provider value={value}>
      <div className={styles.surface}>
        {children}
        {!modal ? <PpeAnnouncement /> : null}
      </div>
    </Live.Provider>
  );
}
export function usePpeAnnouncement() {
  const value = useContext(Live);
  if (!value) throw new Error('PpeFlow is required');
  return value.announce;
}
function PpeAnnouncement() {
  const value = useContext(Live);
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {value?.message}
    </p>
  );
}
export function PpeDialog({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose(): void }>) {
  const live = useContext(Live);
  const setModal = live?.setModal;
  useEffect(() => {
    setModal?.(true);
    return () => setModal?.(false);
  }, [setModal]);
  return (
    <PlanDialog open title={title} onClose={onClose} drawer>
      <div className={`${styles.surface} ${styles.stack}`}>
        {children}
        <PpeAnnouncement />
      </div>
    </PlanDialog>
  );
}
export function usePpeApi() {
  const auth = useAuth();
  const organization = useOrganization();
  const organizationId = organization.activeId!;
  const request = useCallback(
    <T,>(path: string, init?: RequestInit) => auth.request<T>(path, init, organizationId),
    [auth.request, organizationId],
  );
  return { organizationId, role: organization.currentRole ?? '', request };
}
export type PpeApi = ReturnType<typeof usePpeApi>;
export function usePpeCommand<T = { id: string }>(
  api: PpeApi,
  success: string,
  after?: (result: T) => void | Promise<void>,
) {
  const announce = usePpeAnnouncement();
  const queries = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      api.request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    retry: false,
    onSuccess: async (result) => {
      // A failed refresh must not turn a committed command into a save error.
      void queries
        .invalidateQueries({ queryKey: queryKeys.organization.scope(api.organizationId) })
        .catch(() => undefined);
      announce(success);
      await after?.(result);
    },
    onError: () => announce(''),
  });
  const processing = useRealRequestFeedback(mutation.isPending);
  useEffect(() => {
    if (processing) announce('Guardando cambio…');
  }, [processing, announce]);
  const recoverRequired =
    mutation.isError &&
    (!(mutation.error instanceof ApiClientError) || mutation.error.status === 409);
  const [recovering, setRecovering] = useState(false);
  const recover = async () => {
    setRecovering(true);
    try {
      await queries.refetchQueries(
        { queryKey: queryKeys.organization.scope(api.organizationId), type: 'active' },
        { throwOnError: true },
      );
      mutation.reset();
      announce('Información actualizada. Revisa tu borrador antes de continuar.');
    } catch {
      announce('No pudimos actualizar la información. Intenta nuevamente.');
    } finally {
      setRecovering(false);
    }
  };
  const run = (path: string, body: Record<string, unknown>) => {
    if (inFlight.current || recoverRequired || recovering) return;
    inFlight.current = true;
    mutation.mutate(
      { path, body },
      {
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };
  return { ...mutation, run, processing, recoverRequired, recovering, recover };
}
export function PpeCommandFeedback({
  command,
}: {
  command: Pick<
    ReturnType<typeof usePpeCommand>,
    'isError' | 'error' | 'processing' | 'recoverRequired' | 'recovering' | 'recover'
  >;
}) {
  return (
    <>
      {command.processing ? <p>Guardando cambio…</p> : null}
      {command.isError ? (
        <div role="alert" className={styles.warning}>
          <p>
            {command.error instanceof ApiClientError && command.error.status === 409
              ? command.error.payload.code === 'PPE_ISSUE_VERSION_CONFLICT'
                ? 'Este registro cambió en otra sesión. Actualiza la información antes de continuar.'
                : 'El registro ya existe o su contexto cambió. Actualiza la información y revisa la operación.'
              : command.recoverRequired
                ? 'Actualiza el estado antes de continuar. Tu borrador se conserva.'
                : command.error instanceof ApiClientError && command.error.status === 403
                  ? 'Tu acceso no permite guardar esta operación.'
                  : command.error instanceof ApiClientError && command.error.status === 400
                    ? 'Revisa los campos y el contexto de la operación antes de volver a enviarla.'
                    : 'No pudimos guardar el cambio. Intenta nuevamente.'}
          </p>
          {command.recoverRequired ? (
            <button
              type="button"
              className="button secondary"
              disabled={command.recovering}
              onClick={() => void command.recover()}
            >
              Actualizar información
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
export function PpeSubmit({
  command,
  children,
}: PropsWithChildren<{
  command: Pick<
    ReturnType<typeof usePpeCommand>,
    'isPending' | 'isError' | 'recoverRequired' | 'recovering'
  >;
}>) {
  return (
    <button
      className="button"
      type="submit"
      disabled={command.isPending || command.recoverRequired || command.recovering}
    >
      {command.isError && !command.recoverRequired ? 'Reintentar' : children}
    </button>
  );
}
export function PpeReference({ item }: { item: CatalogItem }) {
  return (
    <details className={styles.details}>
      <summary>Referencia declarada</summary>
      <dl className={styles.facts}>
        <div>
          <dt>Referencia</dt>
          <dd>{item.referenceStandard || 'Sin registro'}</dd>
        </div>
        <div>
          <dt>Jurisdicción / contexto</dt>
          <dd>{item.referenceJurisdiction || 'Sin registro'}</dd>
        </div>
        <div>
          <dt>Proveniencia</dt>
          <dd>{item.referenceProvenance || 'Sin registro'}</dd>
        </div>
        <div>
          <dt>Revisión interna</dt>
          <dd>
            {item.referenceReviewStatus
              ? REVIEW_LABELS[item.referenceReviewStatus]
              : 'Sin registro'}
          </dd>
        </div>
      </dl>
      <p>Son datos declarados por la organización. La plataforma no certifica el equipo.</p>
    </details>
  );
}
export function CatalogChoiceSummary({ item }: { item: CatalogItem }) {
  return (
    <span>
      {CATEGORY_LABELS[item.category]} · {item.status === 'INACTIVE' ? 'Inactivo' : 'Activo'} ·{' '}
      {item.referenceReviewStatus
        ? REVIEW_LABELS[item.referenceReviewStatus]
        : 'Sin revisión registrada'}
    </span>
  );
}
