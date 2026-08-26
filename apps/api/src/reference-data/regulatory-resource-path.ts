import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const REGULATORY_RESOURCE_ROOT = resolve(__dirname, '../../../../regulatory');
export const REGULATORY_REVIEW_CORPUS_DIRECTORY = resolve(
  REGULATORY_RESOURCE_ROOT,
  'corpus/ecuador-sst-review-v1',
);
export const REGULATORY_EVIDENCE_DIRECTORY = resolve(
  REGULATORY_RESOURCE_ROOT,
  'evidence/ecuador-official-units-v1',
);
export const REGULATORY_PILOT_DIRECTORY = resolve(
  REGULATORY_RESOURCE_ROOT,
  'pilots/ec-mdt-2024-196-v1',
);

const REQUIRED_RUNTIME_FILES = [
  resolve(REGULATORY_REVIEW_CORPUS_DIRECTORY, 'corpus.json'),
  resolve(REGULATORY_REVIEW_CORPUS_DIRECTORY, 'relationships.json'),
  resolve(REGULATORY_REVIEW_CORPUS_DIRECTORY, 'scenario-review-map.json'),
  resolve(REGULATORY_EVIDENCE_DIRECTORY, 'index.json'),
  resolve(REGULATORY_PILOT_DIRECTORY, 'manifest.json'),
  resolve(REGULATORY_PILOT_DIRECTORY, 'provisions.json'),
  resolve(REGULATORY_PILOT_DIRECTORY, 'requirements.json'),
  resolve(REGULATORY_PILOT_DIRECTORY, 'rule-drafts.json'),
  resolve(REGULATORY_PILOT_DIRECTORY, 'shadow-pack.json'),
  resolve(REGULATORY_PILOT_DIRECTORY, 'source.json'),
] as const;

export function assertRegulatoryRuntimeResources() {
  const missing = REQUIRED_RUNTIME_FILES.find((path) => !existsSync(path));
  if (missing) throw new Error(`REGULATORY_RUNTIME_RESOURCE_NOT_FOUND:${missing}`);
  return REGULATORY_RESOURCE_ROOT;
}
