export type PortfolioFilters = {
  search: string;
  organizationId: string;
  attention: 'ALL' | 'NEEDS_ATTENTION' | 'NO_CRITICAL_PENDING';
  workType: string;
  dueState: 'ALL' | 'OVERDUE' | 'DUE_SOON' | 'FUTURE' | 'NO_DUE';
  signalType: string;
};

export const defaultPortfolioFilters: PortfolioFilters = {
  search: '',
  organizationId: '',
  attention: 'ALL',
  workType: '',
  dueState: 'ALL',
  signalType: '',
};

export function portfolioFilterQuery(filters: PortfolioFilters) {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'ALL') parameters.set(key, value);
  }
  parameters.set('pageSize', '50');
  return parameters.toString();
}

export function portfolioDueLabel(state: string) {
  return (
    {
      OVERDUE: 'Vencido',
      DUE_SOON: 'Próximo a vencer',
      FUTURE: 'Programado',
      NO_DUE: 'Sin fecha',
    }[state] ?? state
  );
}

export function portfolioRoleLabel(role: string) {
  return (
    {
      ORG_OWNER: 'Propietario',
      ORG_ADMIN: 'Administrador',
      SST_MANAGER: 'Responsable SST',
      SST_TECHNICIAN: 'Técnico SST',
      CONSULTANT: 'Consultor',
      VIEWER: 'Consulta',
    }[role] ?? role
  );
}
