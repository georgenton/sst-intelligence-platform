import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeOfficialRegulatoryText, regulatoryOfficialTextHash } from '@sst/contracts';

type UnitType =
  | 'TITLE'
  | 'CHAPTER'
  | 'SECTION'
  | 'ARTICLE'
  | 'DISPOSITION_GENERAL'
  | 'DISPOSITION_TRANSITORY'
  | 'DISPOSITION_REPEAL'
  | 'DISPOSITION_FINAL'
  | 'ANNEX'
  | 'OTHER';

type Marker = { index: number; identifier: string; unitType: UnitType; label: string };

const configurations = [
  { sourceKey: 'EC_CAN_DECISION_584', articleCount: 35, pageCount: 15 },
  { sourceKey: 'EC_CAN_RESOLUTION_957', articleCount: 23, pageCount: 8 },
  { sourceKey: 'EC_IESS_CD_677', articleCount: 20, pageCount: 22 },
  { sourceKey: 'EC_IESS_CD_692', articleCount: 1, pageCount: 5 },
  { sourceKey: 'EC_LABOR_CODE', articleCount: 637, pageCount: 199 },
  { sourceKey: 'EC_MDT_2024_196', articleCount: 30, pageCount: 23 },
  { sourceKey: 'EC_MDT_2024_196_ANNEX_1', articleCount: 0, pageCount: 8, annex: true },
  { sourceKey: 'EC_MDT_2025_122_CONSTRUCTION', articleCount: 147, pageCount: 70 },
] as const;

function deterministicUuid(material: string) {
  const hex = createHash('sha256').update(material).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = '8';
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function pageAt(text: string, index: number) {
  return text.slice(0, Math.max(0, index)).split('\f').length;
}

function safeToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

function articleMarkers(text: string, expectedCount: number) {
  const candidates: Array<{ index: number; number: number }> = [];
  const expression = /^\s*(?:Art(?:í|i)culo|Art\.)\s+(\d+)(?:\s*[-.°º]|\s)/gimu;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(text)))
    candidates.push({ index: match.index, number: Number(match[1]) });
  const markers: Marker[] = [];
  let cursor = 0;
  for (let expected = 1; expected <= expectedCount; expected += 1) {
    const candidate = candidates.find(
      ({ number, index }) => number === expected && index >= cursor,
    );
    if (!candidate) throw new Error(`ARTICLE_SEQUENCE_INCOMPLETE:${expected}/${expectedCount}`);
    markers.push({
      index: candidate.index,
      identifier: `ARTICLE_${expected}`,
      unitType: 'ARTICLE',
      label: `Artículo ${expected}`,
    });
    cursor = candidate.index + 1;
  }
  return markers;
}

function structuralMarkers(text: string, lastArticle: number) {
  const markers: Marker[] = [];
  const counts = new Map<string, number>();
  const headingExpression = /^\s*(T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N)\s+([^\n]+)/gimu;
  let match: RegExpExecArray | null;
  while ((match = headingExpression.exec(text))) {
    if (match.index > lastArticle) continue;
    const unitType = {
      TITULO: 'TITLE',
      CAPITULO: 'CHAPTER',
      SECCION: 'SECTION',
    }[safeToken(match[1]!)] as 'TITLE' | 'CHAPTER' | 'SECTION';
    const base = `${unitType}_${safeToken(match[2]!)}`;
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    markers.push({
      index: match.index,
      identifier: count === 1 ? base : `${base}_${count}`,
      unitType,
      label: `${match[1]} ${match[2]!.trim()}`,
    });
  }

  const dispositionType = (label: string): UnitType => {
    const normalized = safeToken(label);
    if (normalized.startsWith('GENERAL')) return 'DISPOSITION_GENERAL';
    if (normalized.startsWith('TRANSITOR')) return 'DISPOSITION_TRANSITORY';
    if (normalized.startsWith('DEROG') || normalized.startsWith('REPEAL'))
      return 'DISPOSITION_REPEAL';
    return 'DISPOSITION_FINAL';
  };
  const lines = text.split(/(?<=\n)/);
  let offset = 0;
  let currentType: UnitType | null = null;
  let currentCount = 0;
  let currentHeadingCount = 0;
  const dispositionHeadingCounts = new Map<UnitType, number>();
  for (const line of lines) {
    if (offset <= lastArticle) {
      offset += line.length;
      continue;
    }
    const heading = line.match(
      /^\s*DISPOSICI[OÓ]N(?:ES)?\s+(GENERALES?|TRANSITORIAS?|DEROGATORIAS?|REFORMATORIAS?|FINALES?)/iu,
    );
    if (heading) {
      currentType = dispositionType(heading[1]!);
      currentCount = 0;
      const headingCount = (dispositionHeadingCounts.get(currentType) ?? 0) + 1;
      dispositionHeadingCounts.set(currentType, headingCount);
      currentHeadingCount = headingCount;
      markers.push({
        index: offset,
        identifier: `${currentType}_HEADING${headingCount === 1 ? '' : `_${headingCount}`}`,
        unitType: currentType,
        label: heading[0].trim(),
      });
    } else if (currentType) {
      const item = line.match(
        /^\s*(PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|S[EÉ]PTIMA|OCTAVA|NOVENA|D[EÉ]CIMA|[UÚ]NICA)[.,-]/iu,
      );
      if (item) {
        currentCount += 1;
        markers.push({
          index: offset,
          identifier: `${currentType}_${currentHeadingCount}_${currentCount}`,
          unitType: currentType,
          label: item[1]!.toUpperCase(),
        });
      }
    }
    if (/^\s*Dad[oa]\s+en\s+/iu.test(line)) {
      currentType = null;
      markers.push({
        index: offset,
        identifier: 'SIGNATURE',
        unitType: 'OTHER',
        label: 'Suscripción y firmas',
      });
    }
    offset += line.length;
  }
  return markers;
}

function sourceFileName(sourceKey: string) {
  return `${sourceKey.toLowerCase().replaceAll('_', '-')}.json`;
}

const textDirectory = process.env.REGULATORY_TEXT_DIRECTORY;
if (!textDirectory) throw new Error('REGULATORY_TEXT_DIRECTORY_REQUIRED');
const root = resolve(__dirname, '../../..');
const corpusDirectory = resolve(root, 'regulatory/corpus/ecuador-sst-review-v1');
const outputDirectory = resolve(root, 'regulatory/evidence/ecuador-official-units-v1');
mkdirSync(outputDirectory, { recursive: true });

const corpusIndex = JSON.parse(readFileSync(resolve(corpusDirectory, 'corpus.json'), 'utf8')) as {
  sourceFiles: string[];
};
const sources = new Map(
  corpusIndex.sourceFiles.map((file) => {
    const source = JSON.parse(readFileSync(resolve(corpusDirectory, file), 'utf8')) as {
      sourceKey: string;
      versionId: string;
      officialDocumentSha256: string;
      officialUrl: string;
    };
    return [source.sourceKey, source] as const;
  }),
);

const indexEntries: Array<{
  sourceKey: string;
  file: string;
  sourceVersionId: string;
  expectedUnitCount: number;
  articleCount: number;
  pageCount: number;
}> = [];
for (const configuration of configurations) {
  const source = sources.get(configuration.sourceKey);
  if (!source?.officialDocumentSha256 || !source.officialUrl)
    throw new Error(`VERIFIED_SOURCE_METADATA_REQUIRED:${configuration.sourceKey}`);
  const text = readFileSync(resolve(textDirectory, `${configuration.sourceKey}.txt`), 'utf8');
  let markers: Marker[];
  if ('annex' in configuration && configuration.annex) {
    markers = [{ index: 0, identifier: 'ANNEX', unitType: 'ANNEX', label: 'Anexo completo' }];
  } else {
    const articles = articleMarkers(text, configuration.articleCount);
    markers = [
      ...(articles[0]!.index > 0
        ? [{ index: 0, identifier: 'PREAMBLE', unitType: 'OTHER' as const, label: 'Preámbulo' }]
        : []),
      ...articles,
      ...structuralMarkers(text, articles.at(-1)!.index),
    ];
  }
  markers = markers.sort(
    (left, right) => left.index - right.index || left.identifier.localeCompare(right.identifier),
  );
  if (new Set(markers.map(({ identifier }) => identifier)).size !== markers.length)
    throw new Error(`UNIT_IDENTIFIER_DUPLICATE:${configuration.sourceKey}`);
  const units = markers.map((marker, ordinal) => {
    const end = markers[ordinal + 1]?.index ?? text.length;
    const officialText = normalizeOfficialRegulatoryText(
      text.slice(marker.index, end).replaceAll('\f', '\n'),
    );
    if (!officialText)
      throw new Error(`UNIT_TEXT_EMPTY:${configuration.sourceKey}:${marker.identifier}`);
    const pageStart = pageAt(text, marker.index);
    const pageEnd = pageAt(text, Math.max(marker.index, end - 1));
    return {
      id: deterministicUuid(`${source.versionId}:${marker.identifier}`),
      sourceVersionId: source.versionId,
      parentUnitId: null,
      unitType: marker.unitType,
      identifier: marker.identifier,
      heading: null,
      ordinal,
      officialText,
      editorialSummary: null,
      normalizedTextHash: regulatoryOfficialTextHash(officialText),
      pageStart,
      pageEnd,
      locator: `${marker.label} · página${pageStart === pageEnd ? '' : 's'} ${pageStart}${pageStart === pageEnd ? '' : `–${pageEnd}`}`,
      extractionStatus: 'EXTRACTED',
      reviewStatus: 'VERIFIED',
    };
  });
  const expectedIdentifiers = units.map(({ identifier }) => identifier);
  const file = sourceFileName(configuration.sourceKey);
  writeFileSync(
    resolve(outputDirectory, file),
    `${JSON.stringify({ sourceKey: configuration.sourceKey, sourceVersionId: source.versionId, officialDocumentSha256: source.officialDocumentSha256, officialUrl: source.officialUrl, pageCount: configuration.pageCount, textExtractionStatus: 'COMPLETE', expectedIdentifiers, units }, null, 2)}\n`,
  );
  indexEntries.push({
    sourceKey: configuration.sourceKey,
    file,
    sourceVersionId: source.versionId,
    expectedUnitCount: units.length,
    articleCount: configuration.articleCount,
    pageCount: configuration.pageCount,
  });
}

writeFileSync(
  resolve(outputDirectory, 'index.json'),
  `${JSON.stringify({ corpusKey: 'ECUADOR_OFFICIAL_REGULATORY_UNITS_V1', version: '1.0.0', generatedFrom: 'VERIFIED_OFFICIAL_PDF_TEXT_EXTRACTION', sources: indexEntries }, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    status: 'ok',
    sources: indexEntries.length,
    units: indexEntries.reduce((sum, source) => sum + source.expectedUnitCount, 0),
    articles: indexEntries.reduce((sum, source) => sum + source.articleCount, 0),
  }),
);
