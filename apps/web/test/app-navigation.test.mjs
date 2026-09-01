import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import {
  appNavigationItems,
  isNavigationItemVisible,
  resolveActiveNavigationItem,
} from '../lib/app-navigation.ts';

const appDirectory = fileURLToPath(new URL('../app', import.meta.url));

test('every app navigation destination maps to an existing route without placeholders', () => {
  assert.ok(appNavigationItems.length > 0);
  for (const item of appNavigationItems) {
    assert.match(item.href, /^\/app(?:\/[^#?]+)?$/);
    assert.doesNotMatch(item.href, /#|placeholder|todo/i);
    const routeDirectory = item.href === '/app' ? appDirectory : `${appDirectory}${item.href}`;
    assert.equal(existsSync(`${routeDirectory}/page.tsx`), true, `${item.href} must exist`);
  }
});

test('nested application routes retain the correct active parent item', () => {
  const cases = [
    ['/app', 'home'],
    ['/app/inspections', 'inspections'],
    ['/app/inspections/inspection-a', 'inspections'],
    ['/app/inspections/inspection-a/findings/finding-a', 'inspections'],
    ['/app/inspections/alerts', 'inspection-alerts'],
    ['/app/inspections/analytics', 'inspection-analytics'],
    ['/app/applicability', 'applicability'],
    ['/app/applicability/new', 'applicability'],
    ['/app/applicability/sources/EC_IESS_CD_527_INTERVIEW_REFERENCE', 'regulatory-library'],
    ['/app/applicability/assessment-a', 'applicability'],
    ['/app/evaluation/evaluation-a', 'sst-evaluation'],
    ['/app/evaluation/expert-review', 'sst-evaluation'],
    ['/app/technical-risk/assessment-a/review', 'technical-risk'],
    ['/app/risk-methods', 'risk-methods'],
    ['/app/modules/TECHNICAL_RISK', 'modules'],
    ['/app/settings/members', 'members'],
  ];

  for (const [pathname, expectedId] of cases) {
    assert.equal(resolveActiveNavigationItem(pathname)?.id, expectedId, pathname);
  }
});

test('domain links follow effective feature visibility while management stays available', () => {
  const inspections = appNavigationItems.find((item) => item.id === 'inspections');
  const technicalRisk = appNavigationItems.find((item) => item.id === 'technical-risk');
  const workPermits = appNavigationItems.find((item) => item.id === 'work-permits');
  const incidents = appNavigationItems.find((item) => item.id === 'incidents');
  const ppe = appNavigationItems.find((item) => item.id === 'ppe');
  const training = appNavigationItems.find((item) => item.id === 'training');
  const modules = appNavigationItems.find((item) => item.id === 'modules');

  assert.ok(inspections && technicalRisk && workPermits && incidents && ppe && training && modules);
  assert.equal(
    isNavigationItemVisible(inspections, undefined),
    true,
    'missing shell entitlement context must preserve real navigation and backend authority',
  );
  assert.equal(isNavigationItemVisible(inspections, { 'module.inspections': true }), true);
  assert.equal(isNavigationItemVisible(technicalRisk, { 'module.technical_risk': false }), false);
  assert.equal(isNavigationItemVisible(workPermits, undefined), true);
  assert.equal(isNavigationItemVisible(workPermits, { 'module.work_permits': false }), false);
  assert.equal(isNavigationItemVisible(incidents, { 'module.incidents': false }), false);
  assert.equal(isNavigationItemVisible(ppe, { 'module.ppe': false }), false);
  assert.equal(isNavigationItemVisible(training, { 'module.training': false }), false);
  assert.equal(isNavigationItemVisible(modules, undefined), true);
});
