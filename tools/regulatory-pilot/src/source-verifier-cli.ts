import { REGULATORY_PILOT_SOURCE_KEY } from '@sst/contracts';
import { loadRegulatoryPilotManifest } from './manifest.js';
import { verifyOfficialRegulatorySource } from './source-verifier.js';

async function main() {
  const argumentsList = process.argv.slice(2).filter((argument) => argument !== '--');
  if (argumentsList.length !== 1 || argumentsList[0] !== REGULATORY_PILOT_SOURCE_KEY)
    throw new Error('EXACT_SOURCE_KEY_REQUIRED');
  const report = await verifyOfficialRegulatorySource(loadRegulatoryPilotManifest());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main();
