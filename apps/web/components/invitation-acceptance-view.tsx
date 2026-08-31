'use client';

import { ApiClientError } from '@sst/api-client';
import { Button, Card, StatusBadge } from '@sst/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { storeActiveOrganization } from '@/lib/active-organization-storage';
import { humanInvitationStatusLabel, humanRoleLabel } from '@/lib/human-lexicon';
import {
  clearStoredInvitationToken,
  isTerminalInvitationErrorCode,
  isTerminalInvitationStatus,
} from '@/lib/invitation-token-lifecycle';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';

const invitationTokenKey = 'organization-invitation-token:v1';

type InvitationPreview = {
  organizationName: string;
  emailNormalized: string;
  role: string;
  status: string;
  expiresAt: string;
};

type AcceptanceResult = {
  organization: { id: string; name: string };
};

export function InvitationAcceptanceView() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const clearStoredToken = useCallback(
    () => clearStoredInvitationToken(window.sessionStorage, invitationTokenKey),
    [],
  );

  useEffect(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    let storedToken = '';
    try {
      if (fragmentToken) window.sessionStorage.setItem(invitationTokenKey, fragmentToken);
      storedToken = window.sessionStorage.getItem(invitationTokenKey) ?? '';
    } catch {
      setStorageUnavailable(true);
    }
    setToken(fragmentToken || storedToken);
    if (fragmentToken) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const preview = useQuery({
    queryKey: queryKeys.user.invitationPreview(auth.user?.id ?? 'unauthenticated'),
    queryFn: ({ signal }) =>
      auth.request<InvitationPreview>('/organization-invitations/inspect', {
        method: 'POST',
        body: JSON.stringify({ token }),
        signal,
      }),
    enabled: Boolean(token && auth.user && auth.accessToken),
    retry: false,
  });

  const acceptance = useMutation({
    mutationFn: () =>
      auth.request<AcceptanceResult>('/organization-invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    onSuccess: async (result) => {
      clearStoredToken();
      if (auth.user) {
        storeActiveOrganization(window.localStorage, auth.user.id, result.organization.id, [
          result.organization.id,
        ]);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.user.organizations(auth.user.id),
        });
      }
      window.location.assign('/app');
    },
  });

  useEffect(() => {
    if (isTerminalInvitationStatus(preview.data?.status)) clearStoredToken();
  }, [clearStoredToken, preview.data?.status]);

  useEffect(() => {
    const error = acceptance.error ?? preview.error;
    if (error instanceof ApiClientError && isTerminalInvitationErrorCode(error.payload.code)) {
      clearStoredToken();
    }
  }, [acceptance.error, clearStoredToken, preview.error]);

  if (auth.loading || (!token && !storageUnavailable)) {
    return <p>Cargando invitación…</p>;
  }

  if (!token) {
    return (
      <Card className="auth-card stack">
        <h1>Enlace no disponible</h1>
        <p className="field-error" role="alert">
          No encontramos un token de invitación en esta pestaña. Solicita un nuevo enlace al
          administrador de la organización.
        </p>
      </Card>
    );
  }

  if (!auth.user) {
    return (
      <Card className="auth-card stack">
        <div>
          <p className="eyebrow">Invitación a una organización</p>
          <h1>Autentícate para continuar</h1>
          <p className="muted">
            Inicia sesión o crea una cuenta con el mismo correo al que se dirigió la invitación.
          </p>
        </div>
        {storageUnavailable ? (
          <p className="field-error" role="alert">
            El navegador bloqueó el almacenamiento de sesión. Habilítalo antes de autenticarte para
            conservar este enlace de forma privada.
          </p>
        ) : (
          <div className="form-actions">
            <Link className="button" href="/auth/login?next=%2Finvite%2Faccept">
              Iniciar sesión
            </Link>
            <Link className="button secondary" href="/auth/register?next=%2Finvite%2Faccept">
              Crear cuenta
            </Link>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="auth-card stack">
      <div>
        <p className="eyebrow">Invitación a una organización</p>
        <h1>Revisa tu invitación</h1>
      </div>
      {preview.isLoading ? <p>Validando invitación…</p> : null}
      {preview.isError ? (
        <p className="field-error" role="alert">
          {preview.error instanceof Error
            ? preview.error.message
            : 'No pudimos validar esta invitación.'}
        </p>
      ) : null}
      {preview.data ? (
        <div className="stack">
          <div className="module-row">
            <span>
              <small className="muted">Organización</small>
              <br />
              <strong>{preview.data.organizationName}</strong>
            </span>
            <StatusBadge>{humanInvitationStatusLabel(preview.data.status)}</StatusBadge>
          </div>
          <p>
            Acceso como <strong>{humanRoleLabel(preview.data.role)}</strong> para{' '}
            <strong>{preview.data.emailNormalized}</strong>.
          </p>
          {preview.data.status === 'PENDING' ? (
            <Button
              disabled={acceptance.isPending}
              onClick={() => acceptance.mutate()}
              type="button"
            >
              {acceptance.isPending ? 'Aceptando…' : 'Aceptar invitación'}
            </Button>
          ) : null}
        </div>
      ) : null}
      {acceptance.isError ? (
        <p className="field-error" role="alert">
          {acceptance.error instanceof Error
            ? acceptance.error.message
            : 'No pudimos aceptar la invitación.'}
        </p>
      ) : null}
    </Card>
  );
}
