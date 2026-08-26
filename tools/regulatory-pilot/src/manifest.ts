import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';
import {
  validateRegulatoryPilotManifest,
  type RegulatoryPilotManifestBundle,
} from '@sst/contracts';

export const PILOT_RELATIVE_DIRECTORY = 'regulatory/pilots/ec-mdt-2024-196-v1';

export function findRepositoryRoot(start: string) {
  let current = resolve(start);
  const root = parse(current).root;
  while (current !== root) {
    if (existsSync(resolve(current, PILOT_RELATIVE_DIRECTORY, 'manifest.json'))) return current;
    current = dirname(current);
  }
  throw new Error('REGULATORY_PILOT_REPOSITORY_ROOT_NOT_FOUND');
}

function readJson(directory: string, name: string): unknown {
  return JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
}

export function loadRegulatoryPilotManifest(
  repositoryRoot = process.cwd(),
): RegulatoryPilotManifestBundle {
  const directory = resolve(findRepositoryRoot(repositoryRoot), PILOT_RELATIVE_DIRECTORY);
  return validateRegulatoryPilotManifest({
    index: readJson(directory, 'manifest.json'),
    source: readJson(directory, 'source.json'),
    provisions: readJson(directory, 'provisions.json'),
    requirements: readJson(directory, 'requirements.json'),
    ruleDrafts: readJson(directory, 'rule-drafts.json'),
    shadowPack: readJson(directory, 'shadow-pack.json'),
  } as RegulatoryPilotManifestBundle);
}
