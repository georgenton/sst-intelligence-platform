# Organization Team & Invitations V1

Status: implemented candidate; pending external review and merge.

## Purpose and boundary

Team Management V1 makes the existing organization membership model operational from the product.
Every authenticated active member may read the human member list for their active organization.
Only `ORG_OWNER` and `ORG_ADMIN` may create or revoke invitations, change a non-owner member role or
deactivate a non-owner membership. `SST_MANAGER`, `SST_TECHNICIAN`, `CONSULTANT` and `VIEWER` do not
administer membership. API guards and tenant membership remain authoritative; UI visibility is not
authorization.

Invitation role choices are `ORG_ADMIN`, `SST_MANAGER`, `SST_TECHNICIAN`, `CONSULTANT` and `VIEWER`.
An invitation cannot create `ORG_OWNER`. Owner transfer, owner demotion, owner removal, self-role
change and self-deactivation are outside V1.

## Invitation security and lifecycle

`OrganizationInvitation` is tenant-private and uses the finite lifecycle `PENDING`, `ACCEPTED`,
`REVOKED`, `EXPIRED`. Tokens contain 256 random bits. Only their SHA-256 hash is stored, the hash is
unique, and the plaintext token is returned once to the authorized creator. Pending invitations
expire after seven days. Expiry is derived for reads and persisted when a terminal operation
encounters it; no cron or cache service is required.

Acceptance requires an authenticated account whose normalized email exactly matches the invitation.
The invitation row is locked in the same database transaction that creates or reactivates the
unique `(userId, organizationId)` membership and marks the token accepted. Revocation uses the same
row lock. Double acceptance, parallel acceptance and accept-versus-revoke therefore produce one
terminal outcome and never duplicate membership.

Member capacity counts active memberships plus valid pending invitations while holding an
organization-level database lock. A pending invitation reserves its slot. Material actions record
actor and time in `AuditLog`: invitation created, accepted or revoked; membership created or
reactivated; role changed; membership deactivated.

## Delivery and authentication flow

V1 intentionally adds no email provider. An Owner or Admin uses **Copiar enlace de invitación** and
shares it securely with the intended person. The token is placed in the URL fragment so browsers do
not send it to the web server. The acceptance surface immediately moves it to tab-scoped session
storage and removes the fragment from browser history.

An unauthenticated invitee signs in or registers through the existing auth coordinator with an
allowlisted return path, returns to the invitation and accepts explicitly. A registered user follows
the same acceptance step. Tokens are not query parameters, logs or analytics fields.

Future email delivery may send the same bounded link through an approved provider without changing
token or acceptance semantics. Provider selection, deliverability and resend policy are deferred.

## Role changes and historical safety

Owner/Admin may change active non-owner members among the five invitational roles. Deactivation sets
the membership to `SUSPENDED`; it does not delete the membership, user, reviews, actions, approvals,
assignee references or audit history. A later valid invitation for the same email may reactivate the
same membership identity. Current membership and role determine future authorization; historical
records are never rewritten.

## Work Permit integration

A Work Permit requester must select an active approver from the current organization before creating
the draft. Eligible roles remain `ORG_OWNER`, `ORG_ADMIN` and `SST_MANAGER`, and the requester is
excluded from the selector. The API validates the selected user against the tenant and current
membership; arbitrary, cross-organization, inactive, Viewer or self approvers are rejected.

The selected approver remains attached for auditability. Only that currently authorized member may
approve the pending permit. Pending approval projects to the shared Operational Work Queue with the
approver as assignee and remains visible in Command Center attention. If the membership is later
deactivated, history remains but future approval is denied by the current membership guard.

Team Management is foundational organization capability and introduces no commercial feature key.
`module.work_permits` remains an active-demo preview with zero commercial `PlanFeature` assignments.

## Explicit non-goals

- automatic email delivery;
- owner transfer or owner governance;
- bulk invitations, SCIM or directory synchronization;
- a new commercial Team entitlement;
- incident, PPE or training workflows;
- regulatory interpretation or methodology changes.
