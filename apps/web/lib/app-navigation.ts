export type AppNavigationGroupId = 'home' | 'operation' | 'assessments' | 'analysis' | 'management';

export type AppNavigationItem = {
  id: string;
  label: string;
  href: string;
  group: AppNavigationGroupId;
  match: 'exact' | 'segment';
  requiredFeature?:
    | 'module.inspections'
    | 'module.technical_risk'
    | 'module.work_permits'
    | 'module.incidents'
    | 'module.ppe'
    | 'module.training';
};

export type AppNavigationGroup = {
  id: AppNavigationGroupId;
  label: string;
  items: readonly AppNavigationItem[];
};

export const appNavigationGroups: readonly AppNavigationGroup[] = [
  {
    id: 'home',
    label: 'Inicio',
    items: [{ id: 'home', label: 'Inicio', href: '/app', group: 'home', match: 'exact' }],
  },
  {
    id: 'operation',
    label: 'Operación',
    items: [
      {
        id: 'work-queue',
        label: 'Cola de trabajo',
        href: '/app/work',
        group: 'operation',
        match: 'segment',
      },
      {
        id: 'workers',
        label: 'Personas / Trabajadores',
        href: '/app/workers',
        group: 'operation',
        match: 'segment',
      },
      {
        id: 'incidents',
        label: 'Incidentes',
        href: '/app/incidents',
        group: 'operation',
        match: 'segment',
        requiredFeature: 'module.incidents',
      },
      {
        id: 'ppe',
        label: 'EPP',
        href: '/app/ppe',
        group: 'operation',
        match: 'segment',
        requiredFeature: 'module.ppe',
      },
      {
        id: 'sst-evaluation',
        label: 'Evaluación SST',
        href: '/app/evaluation',
        group: 'assessments',
        match: 'segment',
      },
      {
        id: 'inspections',
        label: 'Inspecciones',
        href: '/app/inspections',
        group: 'operation',
        match: 'segment',
        requiredFeature: 'module.inspections',
      },
      {
        id: 'work-permits',
        label: 'Permisos de trabajo',
        href: '/app/work-permits',
        group: 'operation',
        match: 'segment',
        requiredFeature: 'module.work_permits',
      },
      {
        id: 'regulatory-library',
        label: 'Biblioteca normativa',
        href: '/app/applicability/sources',
        group: 'assessments',
        match: 'segment',
      },
      {
        id: 'inspection-alerts',
        label: 'Alertas',
        href: '/app/inspections/alerts',
        group: 'operation',
        match: 'segment',
        requiredFeature: 'module.inspections',
      },
    ],
  },
  {
    id: 'assessments',
    label: 'Evaluaciones',
    items: [
      {
        id: 'applicability',
        label: 'Configuración SST',
        href: '/app/applicability',
        group: 'assessments',
        match: 'segment',
      },
      {
        id: 'technical-risk',
        label: 'Riesgo técnico',
        href: '/app/technical-risk',
        group: 'assessments',
        match: 'segment',
        requiredFeature: 'module.technical_risk',
      },
      {
        id: 'risk-methods',
        label: 'Metodologías',
        href: '/app/risk-methods',
        group: 'assessments',
        match: 'segment',
        requiredFeature: 'module.inspections',
      },
      {
        id: 'inspection-standards',
        label: 'Estándares de inspección',
        href: '/app/settings/inspection-standards',
        group: 'assessments',
        match: 'segment',
        requiredFeature: 'module.inspections',
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Análisis',
    items: [
      {
        id: 'inspection-analytics',
        label: 'Tendencias y recurrencias',
        href: '/app/inspections/analytics',
        group: 'analysis',
        match: 'segment',
        requiredFeature: 'module.inspections',
      },
    ],
  },
  {
    id: 'management',
    label: 'Gestión',
    items: [
      {
        id: 'organization-settings',
        label: 'Organización',
        href: '/app/settings/organization',
        group: 'management',
        match: 'segment',
      },
      {
        id: 'members',
        label: 'Equipo',
        href: '/app/settings/members',
        group: 'management',
        match: 'segment',
      },
      {
        id: 'modules',
        label: 'Módulos',
        href: '/app/modules',
        group: 'management',
        match: 'segment',
      },
      {
        id: 'billing',
        label: 'Plan',
        href: '/app/billing',
        group: 'management',
        match: 'segment',
      },
    ],
  },
] as const;

export const appNavigationItems = appNavigationGroups.flatMap((group) => group.items);

function matchesPathname(item: AppNavigationItem, pathname: string) {
  if (item.match === 'exact') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function resolveActiveNavigationItem(pathname: string) {
  return appNavigationItems
    .filter((item) => matchesPathname(item, pathname))
    .sort((left, right) => right.href.length - left.href.length)[0];
}

export function isNavigationItemVisible(
  item: AppNavigationItem,
  features: Record<string, boolean | number | string> | undefined,
) {
  if (!item.requiredFeature) return true;
  if (!features) return true;
  return features?.[item.requiredFeature] === true;
}
