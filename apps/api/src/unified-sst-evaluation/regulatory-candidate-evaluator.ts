import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildRegulatoryPilotShadowPack,
  validateRegulatoryPilotManifest,
  type RegulatoryPilotManifestBundle,
} from '@sst/contracts';
import {
  assertRegulatoryRuntimeResources,
  REGULATORY_PILOT_DIRECTORY,
} from '../reference-data/regulatory-resource-path';

export function normalizeRegulatoryCountryCode(country: string) {
  const normalized = country.trim().toUpperCase();
  return normalized === 'ECUADOR' || normalized === 'EC' ? 'EC' : country.trim();
}

export function loadRegulatoryCandidatePack() {
  assertRegulatoryRuntimeResources();
  const read = (file: string) =>
    JSON.parse(readFileSync(resolve(REGULATORY_PILOT_DIRECTORY, file), 'utf8')) as unknown;
  const manifest = validateRegulatoryPilotManifest({
    index: read('manifest.json'),
    source: read('source.json'),
    provisions: read('provisions.json'),
    requirements: read('requirements.json'),
    ruleDrafts: read('rule-drafts.json'),
    shadowPack: read('shadow-pack.json'),
  } as RegulatoryPilotManifestBundle);
  return buildRegulatoryPilotShadowPack(manifest);
}
