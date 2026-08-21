import { loadRegulatoryPilotManifest } from './manifest.js';
import { generateAnitaReviewBundle } from './review-bundle.js';

process.stdout.write(
  `${JSON.stringify(generateAnitaReviewBundle(loadRegulatoryPilotManifest()), null, 2)}\n`,
);
