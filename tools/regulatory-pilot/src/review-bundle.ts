import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RegulatoryPilotManifestBundle } from '@sst/contracts';
import { findRepositoryRoot } from './manifest.js';
import { validateRegulatoryPilotCampaign } from './validation.js';

const REVIEW_DIRECTORY = '.artifacts/regulatory-pilot/mdt-2024-196-v1';
const phaseSeparator =
  '\n---\n\n## FASE B — Ahora comparemos con la interpretación candidata del sistema\n\n';
const decision = `\n## Decisión\n\nTECHNICAL_EXPERT_DECISION: PENDING\n\nLEGAL_REVIEW_DECISION: PENDING\n\nOPTIONS: AGREE | AGREE_WITH_CHANGES | DISAGREE | NEEDS_ANOTHER_SOURCE | NEEDS_LEGAL_REVIEW\n\nEXPERT_NOTES:\n\nREQUIRED_CHANGE:\n`;

function blindCase(title: string, workers: number, result: string, limitation: string) {
  return `# ${title}\n\n## FASE A — Revisión sin anclaje\n\nFuente oficial: Acuerdo Ministerial Nro. MDT-2024-196.\n\nLocalizador: artículos 18 y 19.\n\nEscenario factual: organización con ${workers} personas trabajadoras.\n\n¿Qué concluirías?\n\nRESPUESTA:\n\n${phaseSeparator}Según nuestra lectura candidata, ${result}\n\n${limitation}\n\n¿Coincide con tu criterio? ¿Falta otra condición? ¿Esto depende también de otra norma?\n${decision}`;
}

export function generateAnitaReviewBundle(
  manifest: RegulatoryPilotManifestBundle,
  repositoryRoot = process.cwd(),
) {
  const report = validateRegulatoryPilotCampaign(manifest);
  const directory = resolve(findRepositoryRoot(repositoryRoot), REVIEW_DIRECTORY);
  mkdirSync(directory, { recursive: true });
  const files: Record<string, string> = {
    '00-resumen-para-anita.md': `# Revisión técnica — MDT-2024-196\n\nEste paquete presenta una interpretación candidata, todavía no publicada. Revisa primero cada escenario sin ver la conclusión del sistema. La revisión técnica no sustituye la revisión jurídica.\n`,
    '01-fuente-y-alcance.md': `# Fuente y alcance\n\nFuente: ${manifest.source.canonicalTitle}.\n\nEmisor: ${manifest.source.issuer}.\n\nPublicación: ${manifest.source.officialPublicationReference}.\n\nAlcance deliberado: artículos 18 y 19. No se interpretan anexos ni obligaciones sectoriales.\n`,
    '02-articulo-18.md': `# Artículo 18\n\n## FASE A — Lectura profesional\n\nLee el artículo 18 en la fuente oficial y responde: ¿qué registros corresponden a una organización de 1 a 10 personas?\n\nRESPUESTA:\n${phaseSeparator}Según nuestra lectura candidata, la banda de 1 a 10 activa el registro del responsable de SST y el Plan de Prevención de Riesgos Laborales.\n${decision}`,
    '03-articulo-19.md': `# Artículo 19\n\n## FASE A — Lectura profesional\n\nLee el artículo 19 en la fuente oficial y responde: ¿qué registros corresponden a una organización con más de 10 personas?\n\nRESPUESTA:\n${phaseSeparator}Según nuestra lectura candidata, la banda de más de 10 activa el registro del responsable, Reglamento de Higiene y Seguridad, programa psicosocial y plan anual de capacitaciones.\n${decision}`,
    '04-reglas-candidatas.md': `# Reglas candidatas\n\nInterpretación regulatoria candidata. Requiere revisión profesional y no constituye todavía una regla publicada del sistema.\n\n## Matriz de preparación\n\n| Candidato | Revisión técnica de provisión | Revisión técnica de requisito | Revisión jurídica | ¿Publicable? |\n| --- | --- | --- | --- | --- |\n${manifest.requirements.map(({ title }) => `| ${title} | Pendiente | Pendiente | Pendiente | NO |`).join('\n')}\n\n${manifest.requirements.map((item, index) => `## ${index + 1}. ${item.title}\n\n### FASE A — Revisión sin anclaje\n\nFuente oficial: Acuerdo Ministerial Nro. MDT-2024-196.\n\nLocalizador: ${item.provisionKeys.map((key) => (key.endsWith('18') ? 'Artículo 18' : 'Artículo 19')).join(' y ')}.\n\n¿Qué concluirías para este posible requisito?\n\nRESPUESTA:\n\n${phaseSeparator}Según nuestra lectura candidata: ${item.description}\n\n1. ¿La interpretación coincide?\n2. ¿Falta una condición?\n3. ¿Depende de otra norma?\n4. ¿El número de trabajadores se considera a nivel empresa o de otra forma?\n5. ¿Puede cambiar por centro de trabajo?\n6. ¿Qué documento o evidencia pedirías para comprobarlo?\n7. ¿Qué error sería peligroso que cometiera el sistema?\n${decision}`).join('\n')}`,
    '05-caso-servicios-6-personas.md': blindCase(
      'Servicios — 6 personas',
      6,
      'corresponde la rama de 1 a 10 personas.',
      'El resultado solo cubre los candidatos derivados de los artículos 18 y 19.',
    ),
    '06-caso-farmaceutica-80-personas.md': blindCase(
      'Farmacéutica — 80 personas',
      80,
      'corresponde la rama de más de 10 personas.',
      'Los riesgos químicos no cambian esta lectura general; requieren fuentes técnicas adicionales.',
    ),
    '07-caso-construccion-18-personas.md': blindCase(
      'Construcción — 18 personas',
      18,
      'corresponde la rama general de más de 10 personas.',
      'Las obligaciones específicas de construcción están fuera de este piloto y requieren revisión de su propia fuente oficial.',
    ),
    '08-preguntas-para-anita.md': `# Preguntas para Anita\n\nPara cada interpretación:\n\n1. ¿La interpretación coincide?\n2. ¿Falta una condición?\n3. ¿Depende de otra norma?\n4. ¿El número de trabajadores se considera a nivel empresa o de otra forma?\n5. ¿Puede cambiar por centro de trabajo?\n6. ¿Qué documento o evidencia pedirías para comprobarlo?\n7. ¿Qué error sería peligroso que cometiera el sistema?\n\nLas respuestas sobre evidencia son descubrimiento experto y no se automatizan todavía.\n`,
    '09-decision-log.md': `# Registro de decisiones\n\n${manifest.requirements.map(({ title }) => `## ${title}\n\nEXPERT_DECISION: PENDING\n\nOPTIONS: AGREE | AGREE_WITH_CHANGES | DISAGREE | NEEDS_ANOTHER_SOURCE | NEEDS_LEGAL_REVIEW\n\nEXPERT_NOTES:\n\nREQUIRED_CHANGE:\n`).join('\n')}`,
    'TECHNICAL_EVIDENCE.md': `# Evidencia técnica\n\n- Manifest: ${manifest.index.manifestSha256}\n- Fuente: ${manifest.source.sourceKey} v${manifest.source.sourceCatalogVersion}\n- Documento: ${manifest.source.officialDocumentSha256}\n- Provisiones: ${manifest.provisions.map(({ provisionKey }) => provisionKey).join(', ')}\n- Requisitos: ${manifest.requirements.map(({ requirementKey }) => requirementKey).join(', ')}\n- Reglas: ${manifest.ruleDrafts.map(({ rule }) => rule.ruleKey).join(', ')}\n- Casos: ${JSON.stringify(report.workerCases)}\n- Publicación bloqueada: ${report.publicationBlocked ? 'YES' : 'NO'}\n- Reglas específicas de construcción añadidas: NO\n`,
  };
  for (const [name, content] of Object.entries(files))
    writeFileSync(resolve(directory, name), content, 'utf8');
  return { directory, files: Object.keys(files).sort() };
}
