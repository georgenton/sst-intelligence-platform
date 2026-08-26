import { resolve } from 'node:path';
import {
  assertRegulatoryRuntimeResources,
  REGULATORY_EVIDENCE_DIRECTORY,
  REGULATORY_PILOT_DIRECTORY,
  REGULATORY_RESOURCE_ROOT,
  REGULATORY_REVIEW_CORPUS_DIRECTORY,
} from './regulatory-resource-path';

describe('regulatory runtime resource path', () => {
  it('uses one module-relative root independent of the working directory', () => {
    expect(REGULATORY_RESOURCE_ROOT).toBe(resolve(__dirname, '../../../../regulatory'));
    expect(REGULATORY_REVIEW_CORPUS_DIRECTORY).toBe(
      resolve(REGULATORY_RESOURCE_ROOT, 'corpus/ecuador-sst-review-v1'),
    );
    expect(REGULATORY_EVIDENCE_DIRECTORY).toBe(
      resolve(REGULATORY_RESOURCE_ROOT, 'evidence/ecuador-official-units-v1'),
    );
    expect(REGULATORY_PILOT_DIRECTORY).toBe(
      resolve(REGULATORY_RESOURCE_ROOT, 'pilots/ec-mdt-2024-196-v1'),
    );
    expect(assertRegulatoryRuntimeResources()).toBe(REGULATORY_RESOURCE_ROOT);
  });
});
