import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canMutateCentersForClaim,
  canCreateClaimCompany,
  claimDestinationTarget,
  initialClaimDestination,
  reduceClaimDestination,
} from '../lib/sst-assessment-claim.ts';

test('claim destination remains undecided until the user explicitly chooses an organization', () => {
  assert.equal(claimDestinationTarget(initialClaimDestination), null);
  const organizationB = reduceClaimDestination(initialClaimDestination, {
    type: 'choose-existing',
    organizationId: 'organization-b',
  });
  assert.equal(organizationB.mode, 'EXISTING');
  assert.equal(claimDestinationTarget(organizationB), 'organization-b');
  assert.equal(canMutateCentersForClaim(organizationB), false);

  const reset = reduceClaimDestination(organizationB, { type: 'reset' });
  assert.equal(reset.mode, 'UNDECIDED');
  assert.equal(claimDestinationTarget(reset), null);
});

test('new company creation requires a human activity when the assessment has none', () => {
  assert.equal(canCreateClaimCompany('Empresa nueva', '', ''), false);
  assert.equal(canCreateClaimCompany('Empresa nueva', '', 'Manufactura liviana'), true);
  assert.equal(canCreateClaimCompany('Empresa nueva', 'Servicios administrativos', ''), true);
});

test('a user with an active organization can explicitly choose safe new-company setup', () => {
  const newCompany = reduceClaimDestination(initialClaimDestination, { type: 'choose-new' });
  assert.equal(newCompany.mode, 'NEW');
  assert.equal(claimDestinationTarget(newCompany), null);
  assert.equal(canMutateCentersForClaim(newCompany), false);

  const created = reduceClaimDestination(newCompany, {
    type: 'company-created',
    organizationId: 'new-organization',
  });
  assert.equal(claimDestinationTarget(created), 'new-organization');
  assert.equal(canMutateCentersForClaim(created), true);
});
