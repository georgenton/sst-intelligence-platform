# Adaptive SST six-axis model

## 1. APPLICABILITY

What may correspond according to a versioned organization profile and an identified source. V1 uses
six categorical states, deterministic trace and immutable assessment snapshots.

## 2. OPERATIONAL_PROFILE_AND_PRIORITIES

Hazards, operational criticality and what the organization needs to protect. Candidate strategic
priorities include people and health, productive and business continuity, machinery and
infrastructure, financial impact, reputation, contractors and supply chain, and product or service
quality. These priorities help order work; they are not Applicability V1 input.

## 3. REQUIRED_DEPTH

The minimum inspection, evidence and systemic depth justified by applicable requirements,
operational criticality, selected sources and systemic signals. Desired depth may exceed this floor.

## 4. CURRENT_STATE_AND_EVIDENCE

What already exists, at which organization or work center, in which implementation state, and with
what evidence. A declaration and a link are facts to review, not proof of compliance or effectiveness.

## 5. SERVICE_MODEL

Whether work is self-service, assisted or delivered through managed consulting. This controls who
supports the process, not the deterministic applicability outcome.

## 6. COMMERCIAL_PLAN

Product limits, automation and purchased services. Entitlements control product access but never
rewrite the business decision made by a versioned domain engine.

## Critical invariants

- Budget does not change applicability.
- Commercial plan does not remove a mandatory baseline.
- Strategic priority does not change legal applicability.
- Current implementation does not prove compliance.
- Evidence presence does not prove effectiveness.
- Desired depth cannot lower required minimum depth.
- AI may explain a deterministic result but may not make, change or publish it.

## Data flow boundary

`Profile → Applicability Assessment` is implemented. Operational context, current state, depth,
service model and commercial plan remain separate inputs or future domains. Combining axes must be
explicit and versioned; no UI convenience may bypass API authorization or domain invariants.
