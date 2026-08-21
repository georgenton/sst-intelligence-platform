import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateRegulatoryReviewCorpus,
  type RegulatoryCorpusScenarioKey,
  type RegulatoryReviewCorpusBundle,
} from '@sst/contracts';
import { findRepositoryRoot } from './manifest.js';

export const REVIEW_CORPUS_RELATIVE_DIRECTORY = 'regulatory/corpus/ecuador-sst-review-v1';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadRegulatoryReviewCorpus(
  repositoryRoot = process.cwd(),
): RegulatoryReviewCorpusBundle {
  const root = findRepositoryRoot(repositoryRoot);
  const directory = resolve(root, REVIEW_CORPUS_RELATIVE_DIRECTORY);
  const index = readJson(
    resolve(directory, 'corpus.json'),
  ) as RegulatoryReviewCorpusBundle['index'];
  return validateRegulatoryReviewCorpus({
    index,
    sources: index.sourceFiles.map((file) => readJson(resolve(directory, file))),
    relationships: readJson(resolve(directory, 'relationships.json')),
    scenarioMap: readJson(resolve(directory, 'scenario-review-map.json')),
  } as RegulatoryReviewCorpusBundle);
}

export function suggestSourcesForReview(
  corpus: RegulatoryReviewCorpusBundle,
  scenarioKey: RegulatoryCorpusScenarioKey,
) {
  const scenario = corpus.scenarioMap.scenarios.find((item) => item.scenarioKey === scenarioKey);
  if (!scenario) throw new Error(`REVIEW_SCENARIO_NOT_FOUND:${scenarioKey}`);
  return scenario.sourceSuggestions.map(({ sourceKey, reviewReason, status }) => ({
    sourceKey,
    reviewReason,
    status,
  }));
}

export function validateRegulatoryReviewCorpusCampaign(corpus: RegulatoryReviewCorpusBundle) {
  const smallServices = suggestSourcesForReview(corpus, 'small-services');
  const chemicalPharma = suggestSourcesForReview(corpus, 'chemical-pharma');
  const construction = suggestSourcesForReview(corpus, 'construction');
  if (!chemicalPharma.some(({ sourceKey }) => sourceKey === 'EC_MSP_00004_2026_SISAT'))
    throw new Error('SISAT_REVIEW_SOURCE_MISSING');
  if (!construction.some(({ sourceKey }) => sourceKey === 'EC_MDT_2025_122_CONSTRUCTION'))
    throw new Error('CONSTRUCTION_REVIEW_SOURCE_MISSING');
  const routerOutput = [...smallServices, ...chemicalPharma, ...construction];
  if (
    routerOutput.some((suggestion) =>
      ['applicability', 'state', 'minimumDepth', 'configurationItem', 'confidence'].some((key) =>
        Object.prototype.hasOwnProperty.call(suggestion, key),
      ),
    )
  )
    throw new Error('SOURCE_REVIEW_ROUTER_BOUNDARY_BROKEN');
  return {
    corpusVersion: corpus.index.corpusVersion,
    corpusSha256: corpus.index.corpusSha256,
    corpusSourceCount: corpus.sources.length,
    officialReferencesVerified: corpus.sources.filter(
      ({ verificationStatus }) => verificationStatus !== 'UNVERIFIED_REFERENCE',
    ).length,
    officialArtifactsVerified: corpus.sources.filter(
      ({ verificationStatus }) => verificationStatus === 'VERIFIED_OFFICIAL_ARTIFACT',
    ).length,
    readyForExtraction: corpus.sources.filter((source) => source.readyForExtraction).length,
    structuredSources: corpus.sources.filter(
      ({ structuredContentStatus }) => structuredContentStatus === 'STRUCTURED_CANDIDATE',
    ).length,
    publishedRealRules: 0,
    unverifiedReferences: corpus.sources.filter(
      ({ verificationStatus }) => verificationStatus === 'UNVERIFIED_REFERENCE',
    ).length,
    relationshipsPendingReview: corpus.relationships.relationships.filter(
      ({ reviewStatus }) => reviewStatus === 'PENDING_REVIEW',
    ).length,
    sourceReviewRouterCreatesApplicability: false,
    sourceReviewRouterChangesDepth: false,
    scenarios: { smallServices, chemicalPharma, construction },
  };
}

function humanTitle(source: RegulatoryReviewCorpusBundle['sources'][number]) {
  return source.displayTitle.includes(source.referenceNumber) ||
    source.referenceNumber.includes('_')
    ? source.displayTitle
    : `${source.referenceNumber} — ${source.displayTitle}`;
}

function reviewTable(corpus: RegulatoryReviewCorpusBundle) {
  const rows = corpus.sources.map((source) => {
    const available = source.verificationStatus === 'UNVERIFIED_REFERENCE' ? 'Referencia' : 'Sí';
    const official = source.verificationStatus === 'UNVERIFIED_REFERENCE' ? 'No' : 'Sí';
    const verified = source.verificationStatus === 'VERIFIED_OFFICIAL_ARTIFACT' ? 'Sí' : 'No';
    const interpreted =
      source.structuredContentStatus === 'STRUCTURED_CANDIDATE' ? 'Parcial' : 'No';
    return `| ${humanTitle(source)} | ${available} | ${official} | ${verified} | ${interpreted} | No | Sí |`;
  });
  return `| Documento | Lo tenemos | Fuente oficial | Documento verificado | Ya interpretado | Reglas publicadas | Revisión pendiente |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}`;
}

function scenarioSection(
  corpus: RegulatoryReviewCorpusBundle,
  scenarioKey: RegulatoryCorpusScenarioKey,
) {
  const scenario = corpus.scenarioMap.scenarios.find((item) => item.scenarioKey === scenarioKey)!;
  const sourceByKey = new Map(corpus.sources.map((source) => [source.sourceKey, source]));
  return `## ${scenario.displayName}\n\n### ${scenario.heading}\n\n${scenario.sourceSuggestions
    .map(({ sourceKey, reviewReason, presentation }) => {
      const label =
        presentation === 'POSSIBLE_REVIEW_SOURCE'
          ? 'Posible fuente para revisar'
          : 'Fuente para revisar';
      return `- **${humanTitle(sourceByKey.get(sourceKey)!)}** — ${label}. ${reviewReason}`;
    })
    .join(
      '\n',
    )}\n\n> Estas sugerencias no afirman qué normas aplican. Todas requieren revisión experta.\n\n${scenario.missingSourcePrompt}\n\nRESPUESTA:\n\n${scenario.exclusionPrompt}\n\nRESPUESTA:\n`;
}

function relationshipMap(corpus: RegulatoryReviewCorpusBundle) {
  const sourceByKey = new Map(corpus.sources.map((source) => [source.sourceKey, source]));
  return corpus.relationships.relationships
    .map((relationship) => {
      const status =
        relationship.reviewStatus === 'CONFIRMED'
          ? 'Relación documental confirmada'
          : 'Relación pendiente de revisión formal';
      return `- ${humanTitle(sourceByKey.get(relationship.fromSourceKey)!)} → ${humanTitle(sourceByKey.get(relationship.toSourceKey)!)}: ${status}. ${relationship.notes}`;
    })
    .join('\n');
}

export function generateAnitaMultiSourceReview(
  corpus: RegulatoryReviewCorpusBundle,
  repositoryRoot = process.cwd(),
) {
  const root = findRepositoryRoot(repositoryRoot);
  const pilotDirectory = resolve(root, '.artifacts/regulatory-pilot/mdt-2024-196-v1');
  const parentDirectory = resolve(root, '.artifacts/regulatory-pilot');
  mkdirSync(pilotDirectory, { recursive: true });
  const scenarioDocuments = [
    scenarioSection(corpus, 'small-services'),
    scenarioSection(corpus, 'chemical-pharma'),
    scenarioSection(corpus, 'construction'),
  ].join('\n---\n\n');
  const missingCapture = `# Documentos faltantes\n\n## ¿Qué documento nos falta?\n\nTítulo:\n\nEmisor:\n\nNúmero o referencia:\n\n¿Por qué sería relevante?:\n\nEscenario:\n\nNotas de la experta:\n\nLa respuesta no crea automáticamente una fuente ni inicia una búsqueda web.\n`;
  const files: Record<string, string> = {
    '10-corpus-regulatorio.md': `# Corpus regulatorio para revisión\n\n${reviewTable(corpus)}\n\n**C.D. 527:** Referencia mencionada durante entrevista; documento oficial no verificado.\n`,
    '11-mapa-de-documentos.md': `# Mapa de documentos\n\n${relationshipMap(corpus)}\n\nLas relaciones organizan la revisión y no establecen por sí mismas jerarquía, vigencia o aplicabilidad.\n`,
    '12-documentos-por-caso.md': `# Documentos por caso\n\n${scenarioDocuments}`,
    '13-documentos-faltantes.md': missingCapture,
    '14-prioridades-de-revision.md': `# Prioridades de revisión\n\n${corpus.sources
      .map(
        (source) =>
          `- **${source.reviewPriority}** — ${humanTitle(source)}: revisión experta pendiente.`,
      )
      .join('\n')}\n\nLa prioridad es editorial y no altera la aplicabilidad.\n`,
  };
  for (const [name, content] of Object.entries(files))
    writeFileSync(resolve(pilotDirectory, name), content, 'utf8');

  const consolidated = `# Revisión multifuente SST Ecuador — Anita\n\n## 1. Qué estamos probando\n\nEstamos probando si el sistema presenta fuentes oficiales y dudas de procedencia de forma útil para una revisión profesional. Muchas fuentes están visibles, pero solo MDT-2024-196 artículos 18 y 19 tiene una interpretación candidata parcial. No hay reglas regulatorias publicadas.\n\n## 2. Qué documentos conoce hoy el sistema\n\n${reviewTable(corpus)}\n\n## 3. Qué documentos están verificados\n\n${corpus.sources
    .filter(({ verificationStatus }) => verificationStatus === 'VERIFIED_OFFICIAL_ARTIFACT')
    .map((source) => `- ${humanTitle(source)}`)
    .join('\n')}\n\n## 4. Qué documentos todavía no hemos interpretado\n\n${corpus.sources
    .filter(({ structuredContentStatus }) => structuredContentStatus === 'NOT_STRUCTURED')
    .map((source) => `- ${humanTitle(source)}`)
    .join(
      '\n',
    )}\n\n**C.D. 527:** Referencia mencionada durante entrevista; documento oficial no verificado.\n\n## 5. Caso 1 — pequeña servicios\n\n${scenarioSection(corpus, 'small-services')}\n\n## 6. Caso 2 — química/farmacéutica\n\n${scenarioSection(corpus, 'chemical-pharma')}\n\n## 7. Caso 3 — construcción\n\n${scenarioSection(corpus, 'construction')}\n\n## 8. Fuentes que proponemos revisar\n\nLas listas anteriores buscan estimular el recuerdo experto. “Fuente para revisar” no significa “norma aplicable”.\n\n## 9. Resultado real candidato MDT-2024-196\n\nLa única interpretación real candidata conservada es la separación por número de personas de los artículos 18 y 19 para los escenarios de 6, 80 y 18 personas. Sigue pendiente de revisión técnica y jurídica y no está publicada.\n\n## 10. Documentos que todavía faltan interpretar\n\nTodos excepto el alcance parcial indicado de MDT-2024-196.\n\n## 11. ¿Qué documento nos falta?\n\nRESPUESTA:\n\n## 12. ¿Cuál de estos no usarías?\n\nRESPUESTA:\n\n## 13. Relaciones entre documentos\n\n${relationshipMap(corpus)}\n\n## 14. Próximos documentos a estructurar\n\nPROPUESTA DE ANITA:\n\nMOTIVO:\n\n## 15. Decisiones de Anita\n\nDECISIÓN TÉCNICA:\n\nFUENTES QUE FALTAN:\n\nFUENTES QUE SOBRAN:\n\nRELACIONES A REVISAR:\n\nCAMBIOS REQUERIDOS:\n`;
  const consolidatedPath = resolve(parentDirectory, 'ANITA_MULTI_SOURCE_REVIEW_V1.md');
  writeFileSync(consolidatedPath, consolidated, 'utf8');
  if (!existsSync(consolidatedPath)) throw new Error('ANITA_MULTI_SOURCE_REVIEW_NOT_WRITTEN');
  return {
    corpusDirectory: pilotDirectory,
    files: Object.keys(files).sort(),
    consolidatedPath,
  };
}
