import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INSPECTION_CRITERION_OUTCOME_LABELS,
  INSPECTION_DOMAINS,
  INSPECTION_DOMAIN_LABELS,
  INSPECTION_STANDARD_RIGHTS_LABELS,
} from '../lib/inspection-standard-presentation.ts';

test('presents all inspection standard tokens with bounded human labels', () => {
  assert.equal(INSPECTION_DOMAINS.length, 6);
  assert.deepEqual(Object.keys(INSPECTION_DOMAIN_LABELS), [...INSPECTION_DOMAINS]);
  assert.equal(INSPECTION_CRITERION_OUTCOME_LABELS.NO_CONFORME, 'No conforme');
  assert.equal(INSPECTION_STANDARD_RIGHTS_LABELS.DEMO_SYNTHETIC, 'Demostración conceptual');
  assert.equal(
    Object.values({
      ...INSPECTION_DOMAIN_LABELS,
      ...INSPECTION_CRITERION_OUTCOME_LABELS,
      ...INSPECTION_STANDARD_RIGHTS_LABELS,
    }).some((label) => label.includes('_')),
    false,
  );
});
