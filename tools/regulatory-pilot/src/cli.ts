import { loadRegulatoryPilotManifest } from './manifest.js';
import { validateRegulatoryPilotCampaign } from './validation.js';

const report = validateRegulatoryPilotCampaign(loadRegulatoryPilotManifest());
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
