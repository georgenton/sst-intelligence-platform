# ADR — User, Membership and Worker are different concepts

Status: accepted for Workforce Safety Operations V1.

## Decision

`User`, `Membership` and `Worker` remain separate aggregates:

- `User` is the identity that authenticates in the SaaS.
- `Membership` grants a User a current role in one Organization.
- `Worker` is a person whose occupational-safety lifecycle is managed by one Organization.

A Worker can exist without a User and therefore without a login. Creating a Worker does not create
a User or Membership and does not consume `organization.max_members`. A Worker may link to one
existing User only after the API verifies an active membership in the same organization. The link
does not grant authorization and is organization-specific.

## Lifecycle and history

Worker status is deliberately finite: `ACTIVE` or `INACTIVE`. Deactivation is non-destructive.
Incidents, EPP deliveries and inspections, training requirements, sessions and completions keep
their original Worker identity. Unlinking a User or suspending that User's Membership has no effect
on Worker status or history; authorization continues to derive from current Membership state.

## Privacy boundary

V1 stores only operational identity and assignment data: display name, optional internal code,
Work Center, optional job title, dates and bounded notes. It does not store national identity,
date of birth, home address, salary, diagnoses, clinical records, disability or health history.

## Authorization

Owner, Organization Admin and SST Manager administer Workers. SST Technician can read and select
Workers in SST workflows. Consultant and Viewer receive only the read access already permitted by
organization access; neither role receives workforce administration. API guards are authoritative.

## Consequences

All workforce queries include the authenticated organization. Operational actors remain
authenticated Users; a Worker without an account is never fabricated as an audit actor. Future HR,
payroll and occupational-medicine concerns require separate explicit decisions.
