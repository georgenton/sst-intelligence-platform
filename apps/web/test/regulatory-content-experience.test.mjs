import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import {
  REGULATORY_CONTENT_BOUNDARY_COPY,
  REGULATORY_CONTENT_EMPTY_COPY,
  regulatoryRequirementStatusLabels,
} from '../lib/regulatory-content-experience.ts';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

test('structured content copy avoids closed-world and applicability claims', () => {
  assert.match(REGULATORY_CONTENT_EMPTY_COPY, /todavía no ha sido estructurado/);
  assert.match(REGULATORY_CONTENT_EMPTY_COPY, /no significa que no existan requisitos legales/i);
  assert.match(REGULATORY_CONTENT_BOUNDARY_COPY, /No decide si aplica/);
  assert.equal(
    regulatoryRequirementStatusLabels.APPROVED_FOR_RULE_DRAFTING,
    'Listo para redactar regla',
  );
  assert.doesNotMatch(REGULATORY_CONTENT_BOUNDARY_COPY, /debe cumplir|no aplica|cumple/i);
});

test('secondary requirement routes and provenance UI are present without write controls', () => {
  assert.equal(existsSync(`${webRoot}/app/app/applicability/requirements/page.tsx`), true);
  assert.equal(
    existsSync(`${webRoot}/app/app/applicability/requirements/[requirementKey]/page.tsx`),
    true,
  );
  const sourceUi = readFileSync(`${webRoot}/components/regulatory-source-ui.tsx`, 'utf8');
  const requirementUi = readFileSync(`${webRoot}/components/regulatory-requirement-ui.tsx`, 'utf8');
  const styles = readFileSync(`${webRoot}/styles/applicability-experience.css`, 'utf8');
  assert.match(sourceUi, /Contenido estructurado/);
  assert.match(sourceUi, /Disposiciones/);
  assert.match(sourceUi, /Requisitos relacionados/);
  assert.match(sourceUi, /signal/);
  assert.match(requirementUi, /¿De dónde salió\?/);
  assert.match(requirementUi, /sourceVersion\.catalogVersion/);
  assert.match(requirementUi, /signal/);
  assert.doesNotMatch(
    `${sourceUi}\n${requirementUi}`,
    /Agregar disposición|Editar requisito|Guardar cambios|Eliminar requisito/,
  );
  assert.doesNotMatch(`${sourceUi}\n${requirementUi}`, /module\.applicability/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.match(styles, /\.regulatory-structured-grid/);
  assert.doesNotMatch(styles, /min-width:\s*[4-9]\d{2}px/);
});
