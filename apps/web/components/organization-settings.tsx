'use client';

import { Button, Card, StatusBadge } from '@sst/ui';
import { ApiClientError } from '@sst/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { queryKeys } from '@/lib/query-keys';
import { humanRoleLabel } from '@/lib/human-lexicon';
import { useAuth } from './auth-provider';
import { useOrganization } from './app-shell';
import { useDashboardData } from './use-app-data';

type Details = {
  id: string;
  name: string;
  country: string;
  sector?: string;
  workCenters: Array<{
    id: string;
    name: string;
    city?: string;
    isDemo: boolean;
    isActive: boolean;
  }>;
};

type WorkCenter = {
  id: string;
  name: string;
  city?: string;
  isDemo: boolean;
  isActive: boolean;
  _count: { workAreas: number; inspections: number; technicalAssessments: number };
};

export function OrganizationSettings() {
  const auth = useAuth();
  const organization = useOrganization();
  const dashboard = useDashboardData();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const organizationId = organization.activeId;
  const userId = auth.user?.id;
  const activeOrganization = organization.organizations.find(({ id }) => id === organizationId);
  const role = activeOrganization?.memberships[0]?.role;
  const canManage = role === 'ORG_OWNER' || role === 'ORG_ADMIN';
  const centerLimit = dashboard.data?.entitlements.features['organization.max_work_centers'];
  const query = useQuery({
    queryKey: queryKeys.organization.details(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<Details>(`/organizations/${organizationId}`, { signal }, organizationId!),
    enabled: Boolean(organizationId),
  });
  const { register, handleSubmit } = useForm<{ name: string; sector: string }>({
    values: query.data ? { name: query.data.name, sector: query.data.sector ?? '' } : undefined,
  });
  const centers = useQuery({
    queryKey: queryKeys.organization.workCenters(organizationId ?? 'inactive'),
    queryFn: ({ signal }) =>
      auth.request<WorkCenter[]>(
        `/organizations/${organizationId}/work-centers`,
        { signal },
        organizationId!,
      ),
    enabled: Boolean(organizationId),
  });
  const createForm = useForm<{ name: string; city: string }>({
    defaultValues: { name: '', city: '' },
  });
  const selectedCenter =
    centers.data?.find(({ id }) => id === selectedCenterId) ?? centers.data?.[0];
  const centerForm = useForm<{ name: string; city: string; isActive: boolean }>({
    values: selectedCenter
      ? {
          name: selectedCenter.name,
          city: selectedCenter.city ?? '',
          isActive: selectedCenter.isActive,
        }
      : undefined,
  });
  async function refreshCenters() {
    await Promise.all([
      centers.refetch(),
      queryClient.invalidateQueries({ queryKey: queryKeys.organization.details(organizationId!) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.dashboard(organizationId!),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.inspectionContext(organizationId!),
      }),
    ]);
  }
  const createCenter = useMutation({
    mutationFn: (body: { name: string; city: string }) =>
      auth.request<WorkCenter>(
        `/organizations/${organizationId}/work-centers`,
        { method: 'POST', body: JSON.stringify({ name: body.name, city: body.city || undefined }) },
        organizationId!,
      ),
    onSuccess: async (center) => {
      createForm.reset();
      setSelectedCenterId(center.id);
      setMessage('Centro de trabajo creado.');
      await refreshCenters();
    },
  });
  const updateCenter = useMutation({
    mutationFn: (body: { name: string; city: string; isActive: boolean }) =>
      auth.request<WorkCenter>(
        `/organizations/${organizationId}/work-centers/${selectedCenter!.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ ...body, city: body.city || undefined }),
        },
        organizationId!,
      ),
    onSuccess: async () => {
      setMessage('Centro de trabajo actualizado.');
      await refreshCenters();
    },
  });
  const submit = handleSubmit(async (body) => {
    await auth.request(
      `/organizations/${organization.activeId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
      organization.activeId!,
    );
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.organization.details(organizationId!),
      }),
      userId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.user.organizations(userId) })
        : Promise.resolve(),
    ]);
    setMessage('Datos actualizados.');
  });
  if (!organization.activeId) return <p>Selecciona una organización.</p>;
  if (query.isLoading || centers.isLoading) return <p>Cargando empresa…</p>;
  if (!query.data || centers.isError)
    return <p className="field-error">No pudimos cargar la empresa.</p>;
  return (
    <div className="stack">
      <div>
        <p className="eyebrow">Configuración</p>
        <h1>Empresa y centros de trabajo</h1>
      </div>
      <div className="grid">
        <Card>
          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label htmlFor="org-name">Nombre</label>
              <input id="org-name" {...register('name', { required: true })} />
            </div>
            <div className="field">
              <label htmlFor="org-sector">Sector</label>
              <input id="org-sector" {...register('sector')} />
            </div>
            <div className="field">
              <label>País</label>
              <input value={query.data.country} disabled />
            </div>
            {message && <p role="status">{message}</p>}
            {canManage ? (
              <Button>Guardar cambios</Button>
            ) : (
              <p>Tu rol ({humanRoleLabel(role)}) permite consultar estos datos.</p>
            )}
          </form>
        </Card>
        <Card className="stack" id="work-centers">
          <h2>Centros de trabajo</h2>
          <p className="muted">
            {typeof centerLimit === 'number'
              ? `Tu plan permite hasta ${centerLimit} centros de trabajo.`
              : 'La capacidad depende de tu plan actual.'}
          </p>
          {centers.data?.map((center) => (
            <button
              className="card module-row"
              type="button"
              key={center.id}
              aria-pressed={selectedCenter?.id === center.id}
              onClick={() => setSelectedCenterId(center.id)}
            >
              <span>
                <strong>{center.name}</strong>
                {center.city ? ` · ${center.city}` : ''}
              </span>
              <span>
                <StatusBadge>{center.isActive ? 'Activo' : 'Inactivo'}</StatusBadge>
                {center.isDemo && <StatusBadge>Sintético</StatusBadge>}
              </span>
            </button>
          ))}
          {canManage ? (
            <form
              className="stack"
              onSubmit={createForm.handleSubmit((body) => createCenter.mutate(body))}
            >
              <h3>Nuevo centro</h3>
              <div className="field">
                <label htmlFor="new-center-name">Nombre</label>
                <input
                  id="new-center-name"
                  {...createForm.register('name', { required: true, minLength: 2 })}
                />
              </div>
              <div className="field">
                <label htmlFor="new-center-city">Ciudad · opcional</label>
                <input id="new-center-city" {...createForm.register('city')} />
              </div>
              {createCenter.isError ? (
                <p className="field-error" role="alert">
                  {createCenter.error instanceof ApiClientError
                    ? createCenter.error.message
                    : 'No pudimos crear el centro.'}
                </p>
              ) : null}
              <Button disabled={createCenter.isPending}>
                {createCenter.isPending ? 'Creando…' : 'Crear centro'}
              </Button>
            </form>
          ) : null}
        </Card>
      </div>
      {selectedCenter ? (
        <Card className="stack" aria-labelledby="work-center-detail-title">
          <div>
            <p className="eyebrow">Detalle del centro</p>
            <h2 id="work-center-detail-title">{selectedCenter.name}</h2>
            <p>
              {selectedCenter._count.workAreas} áreas · {selectedCenter._count.inspections}{' '}
              inspecciones · {selectedCenter._count.technicalAssessments} evaluaciones técnicas
            </p>
          </div>
          {canManage ? (
            <form
              className="stack"
              onSubmit={centerForm.handleSubmit((body) => updateCenter.mutate(body))}
            >
              <div className="field">
                <label htmlFor="center-name">Nombre</label>
                <input
                  id="center-name"
                  {...centerForm.register('name', { required: true, minLength: 2 })}
                />
              </div>
              <div className="field">
                <label htmlFor="center-city">Ciudad · opcional</label>
                <input id="center-city" {...centerForm.register('city')} />
              </div>
              <label>
                <input type="checkbox" {...centerForm.register('isActive')} /> Centro activo para
                nuevas operaciones
              </label>
              <p className="muted">
                Al inactivarlo, su historial permanece visible y no se elimina.
              </p>
              {updateCenter.isError ? (
                <p className="field-error" role="alert">
                  {updateCenter.error instanceof ApiClientError
                    ? updateCenter.error.message
                    : 'No pudimos actualizar el centro.'}
                </p>
              ) : null}
              <Button disabled={updateCenter.isPending}>
                {updateCenter.isPending ? 'Guardando…' : 'Guardar centro'}
              </Button>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
