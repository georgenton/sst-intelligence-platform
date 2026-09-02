import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultPortfolioFilters,
  portfolioDueLabel,
  portfolioFilterQuery,
  portfolioRoleLabel,
} from '../lib/portfolio-experience.ts';
import { queryKeys } from '../lib/query-keys.ts';

test('portfolio query keys remain user-scoped instead of organization-global', () => {
  assert.deepEqual(queryKeys.user.portfolio('user-a', 'attention=NEEDS_ATTENTION'), [
    'private',
    'user',
    'user-a',
    'portfolio',
    'attention=NEEDS_ATTENTION',
  ]);
  assert.notDeepEqual(queryKeys.user.portfolio('user-a'), queryKeys.user.portfolio('user-b'));
});

test('portfolio filters serialize only bounded active values', () => {
  assert.equal(portfolioFilterQuery(defaultPortfolioFilters), 'pageSize=50');
  const query = portfolioFilterQuery({
    ...defaultPortfolioFilters,
    search: 'Empresa Alfa',
    attention: 'NEEDS_ATTENTION',
    dueState: 'OVERDUE',
  });
  assert.equal(query, 'search=Empresa+Alfa&attention=NEEDS_ATTENTION&dueState=OVERDUE&pageSize=50');
});

test('portfolio presentation uses human labels without safety scores', () => {
  assert.equal(portfolioDueLabel('OVERDUE'), 'Vencido');
  assert.equal(portfolioRoleLabel('CONSULTANT'), 'Consultor');
});
