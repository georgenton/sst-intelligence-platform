import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import {
  REGULATORY_SOURCE_BOUNDARY_COPY,
  regulatoryCandidateStatusLabels,
  regulatorySourceQueryString,
  regulatorySupersessionStatusLabels,
} from '../lib/regulatory-source-experience.ts';

const webRoot = fileURLToPath(new URL('..', import.meta.url));

test('catalog filters serialize deterministically without tenant identity', () => {
  assert.equal(
    regulatorySourceQueryString({
      issuer: ' Ministerio del Trabajo ',
      documentType: 'ANNEX',
      candidateStatus: 'TECHNICAL_REVIEW_PENDING',
    }),
    '?issuer=Ministerio+del+Trabajo&documentType=ANNEX&candidateStatus=TECHNICAL_REVIEW_PENDING',
  );
  assert.equal(
    regulatorySourceQueryString({ issuer: '', documentType: '', candidateStatus: '' }),
    '',
  );
});

test('safe copy keeps editorial workflow separate from legal interpretation', () => {
  assert.match(REGULATORY_SOURCE_BOUNDARY_COPY, /no significa/);
  assert.equal(regulatoryCandidateStatusLabels.REJECTED_REFERENCE, 'Referencia no verificada');
  assert.equal(
    regulatorySupersessionStatusLabels.RELATION_REVIEW_REQUIRED,
    'Relación pendiente de revisión formal',
  );
  assert.doesNotMatch(
    Object.values(regulatoryCandidateStatusLabels).join(' '),
    /cumple|obligatoria|legalmente vigente/i,
  );
});

test('routes, async states and narrow reflow are explicit', () => {
  assert.equal(existsSync(`${webRoot}/app/app/applicability/sources/page.tsx`), true);
  assert.equal(existsSync(`${webRoot}/app/app/applicability/sources/[sourceKey]/page.tsx`), true);
  const component = readFileSync(`${webRoot}/components/regulatory-source-ui.tsx`, 'utf8');
  const styles = readFileSync(`${webRoot}/styles/applicability-experience.css`, 'utf8');
  assert.match(component, /Cargando fuentes de referencia/);
  assert.match(component, /No pudimos cargar las fuentes/);
  assert.match(component, /No hay coincidencias/);
  assert.match(component, /Fuentes candidatas/);
  assert.match(component, /signal/);
  assert.doesNotMatch(component, /Editar fuente|Guardar cambios|Eliminar fuente/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.match(styles, /\.regulatory-source-card/);
  assert.doesNotMatch(styles, /min-width:\s*[4-9]\d{2}px/);
});
