import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.ANITA_REVIEW_BASE_URL;
const share = process.env.ANITA_REVIEW_VERCEL_SHARE;
if (!base || !share)
  throw new Error('ANITA_REVIEW_BASE_URL and ANITA_REVIEW_VERCEL_SHARE are required.');
if (process.env.ANITA_REVIEW_FIXTURE !== 'STAGING_ONLY')
  throw new Error('ANITA_REVIEW_FIXTURE=STAGING_ONLY is required.');
if (
  [process.env.NODE_ENV, process.env.VERCEL_ENV, process.env.RAILWAY_ENVIRONMENT_NAME]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes('production'))
) {
  throw new Error('Refusing screenshot capture because a production signal was detected.');
}
if (!process.env.ANITA_REVIEW_EMAIL || !process.env.ANITA_REVIEW_PASSWORD) {
  throw new Error(
    'Synthetic owner credentials must be provided through env; none are stored by this script.',
  );
}

const verifier = await import('./verify-staging.mjs');
void verifier;

const output = path.resolve('design-handoff/anita-visual-review-v1');
fs.mkdirSync(output, { recursive: true });
const routes = [
  ['01-home', '/app'],
  ['02-evaluation', '/app/evaluation'],
  ['03-plans', '/app/plans'],
  ['04-work-queue', '/app/work'],
  ['05-field', '/app/field'],
  ['06-search', '/app/search'],
  ['07-workers', '/app/workers'],
  ['08-incidents', '/app/incidents'],
  ['09-safety-observations', '/app/safety-observations'],
  ['10-ppe', '/app/ppe'],
  ['11-training', '/app/training'],
  ['12-inspections', '/app/inspections'],
  ['13-inspection-alerts', '/app/inspections/alerts'],
  ['14-technical-risk', '/app/technical-risk'],
  ['15-risk-methods', '/app/risk-methods'],
  ['16-management-intelligence', '/app/management-intelligence'],
  ['17-operational-signals', '/app/intelligence'],
  ['18-inspection-analytics', '/app/inspections/analytics'],
  ['19-organization', '/app/settings/organization'],
  ['20-members', '/app/settings/members'],
  ['21-evidence-packages', '/app/evidence-packages'],
  ['22-modules', '/app/modules'],
  ['23-billing', '/app/billing'],
  ['28-health-at-work', '/app/health-at-work'],
  ['29-psychosocial', '/app/psychosocial'],
  ['30-regulatory-library', '/app/applicability/sources'],
];
const reviewOrganization = 'SST Intelligence — Revisión Anita';
const routeConcepts = new Map([
  ['/app', 'Centro de comando'],
  ['/app/evaluation', 'Evaluación SST'],
  ['/app/plans', 'Plan operativo'],
  ['/app/work', 'Cola de trabajo'],
  ['/app/field', 'Contexto de campo'],
  ['/app/search', 'Búsqueda operativa'],
  ['/app/workers', 'Equipo de trabajadores'],
  ['/app/inspections', 'Inspecciones'],
  ['/app/inspections/alerts', 'Alertas de inspección'],
  ['/app/technical-risk', 'Riesgo técnico'],
  ['/app/risk-methods', 'Métodos de riesgo'],
  ['/app/management-intelligence', 'Inteligencia de gestión'],
  ['/app/intelligence', 'Señales operativas'],
  ['/app/inspections/analytics', 'Analítica de inspecciones'],
  ['/app/settings/organization', 'Organización y centros'],
  ['/app/settings/members', 'Equipo y miembros'],
  ['/app/evidence-packages', 'Paquetes de evidencia'],
  ['/app/modules', 'Módulos y capacidades'],
  ['/app/billing', 'Facturación'],
  ['/app/incidents', 'Incidentes'],
  ['/app/safety-observations', 'Observaciones de seguridad'],
  ['/app/ppe', 'Protección personal'],
  ['/app/training', 'Capacitación'],
  ['/app/health-at-work', 'Salud en el trabajo'],
  ['/app/psychosocial', 'Prevención de riesgos psicosociales'],
  ['/app/applicability/sources', 'Biblioteca normativa'],
]);
const decisionPaByRoute = new Map([
  ['/app/health-at-work', 'PA-09'],
  ['/app/psychosocial', 'PA-09'],
  ['/app/applicability/sources', 'PA-10/PA-11'],
]);
const mobileRoutes = [
  ['24-mobile-home', '/app'],
  ['25-mobile-evaluation', '/app/evaluation'],
  ['26-mobile-ppe', '/app/ppe'],
  ['27-mobile-work-queue', '/app/work'],
];
const context = await chromium.launch({ headless: true });
const desktop = await context.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await desktop.newPage();
const shareUrl = `${base.replace(/\/$/, '')}/?_vercel_share=${encodeURIComponent(share)}`;
await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.goto(`${base.replace(/\/$/, '')}/auth/login`, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
await page.getByLabel('Correo').fill(process.env.ANITA_REVIEW_EMAIL);
await page.getByLabel('Contraseña').fill(process.env.ANITA_REVIEW_PASSWORD);
await Promise.all([
  page.waitForURL(/\/app(?:\/|$)/, { timeout: 60_000 }),
  page.getByRole('button', { name: 'Entrar' }).click(),
]);
const captures = [];
const expectedContent = new Map([
  ['/app', ['Centro de comando']],
  ['/app/evaluation', ['Evaluación SST']],
  ['/app/plans', ['Plan vigente', 'Plan operativo']],
  ['/app/inspections', ['Inspecciones']],
  ['/app/ppe', ['Protección personal', 'EPP']],
  ['/app/health-at-work', ['Salud en el trabajo']],
  ['/app/psychosocial', ['Prevención de riesgos psicosociales']],
  ['/app/settings/members', ['Equipo y miembros']],
  ['/app/applicability/sources', ['Biblioteca normativa']],
]);
async function assertContent(route) {
  const expected = expectedContent.get(route);
  if (!expected) return;
  const body = await page.locator('body').innerText();
  if (!expected.some((text) => body.includes(text))) {
    throw new Error(`Expected review content missing for ${route}: ${expected.join(' / ')}`);
  }
}
for (const [name, route] of routes) {
  const response = await page.goto(`${base.replace(/\/$/, '')}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForTimeout(5000);
  await assertContent(route);
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  captures.push({
    name,
    route,
    status: response?.status() ?? null,
    title: await page.title(),
    viewport: { width: 1440, height: 1000 },
    syntheticOrganization: reviewOrganization,
    concept: routeConcepts.get(route) ?? route,
    decisionPa: decisionPaByRoute.get(route) ?? null,
    screenshot: `${name}.png`,
  });
}
await desktop.close();
const mobile = await context.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await mobilePage.goto(`${base.replace(/\/$/, '')}/auth/login`, {
  waitUntil: 'domcontentloaded',
  timeout: 60_000,
});
await mobilePage.getByLabel('Correo').fill(process.env.ANITA_REVIEW_EMAIL);
await mobilePage.getByLabel('Contraseña').fill(process.env.ANITA_REVIEW_PASSWORD);
await Promise.all([
  mobilePage.waitForURL(/\/app(?:\/|$)/, { timeout: 60_000 }),
  mobilePage.getByRole('button', { name: 'Entrar' }).click(),
]);
for (const [name, route] of mobileRoutes) {
  const response = await mobilePage.goto(`${base.replace(/\/$/, '')}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await mobilePage.waitForTimeout(5000);
  await mobilePage.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  captures.push({
    name,
    route,
    status: response?.status() ?? null,
    title: await mobilePage.title(),
    viewport: { width: 390, height: 844 },
    syntheticOrganization: reviewOrganization,
    concept: routeConcepts.get(route) ?? route,
    decisionPa: decisionPaByRoute.get(route) ?? null,
    screenshot: `${name}.png`,
  });
}
await context.close();
fs.writeFileSync(
  path.join(output, 'manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: base, captures, session: 'synthetic owner; no storageState persisted' }, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    captures: captures.length,
    successful: captures.filter((capture) => capture.status === 200).length,
  }),
);
