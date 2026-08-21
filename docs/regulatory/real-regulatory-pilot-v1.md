# Controlled Real Regulatory Pilot V1 — MDT-2024-196

## Purpose

This pilot turns two official article locators into reviewable candidates without publishing legal
rules. It binds the editorial material to `EC_MDT_2024_196` catalog version 2 and its verified
document fingerprint. The only included provisions are Articles 18 and 19.

The manifest contains two provision candidates, five requirement candidates and five real,
non-DEMO Adaptive Rule drafts. Every item remains `TECHNICAL_REVIEW_PENDING`; technical and legal
decisions are separate and both start `PENDING`. An official source is evidence, not approval.

## Interpreted candidate boundary

- 1–10 workers: responsible-for-SST registration and Prevention Plan registration.
- More than 10 workers: responsible-for-SST registration, Hygiene and Safety Regulation,
  psychosocial-program registration and annual-training-plan registration.
- Missing worker count: `NEEDS_INFORMATION` plus a dynamic question.
- Zero workers: invalid under the existing fact contract and never coerced into Article 18.

This is a candidate interpretation for expert review. It is not legal advice, a compliance
guarantee or a published product decision. Annexes, industry-specific requirements and technical
content from additional sources remain outside the pilot.

## Future composition

An organization may eventually receive contributions from a general regulatory pack, a
sector-specific pack, a work-center-specific pack and a technical-source pack. This increment only
documents that composition; it does not implement multi-pack runtime merging. For construction,
the general Article 19 layer remains visible while construction-specific obligations await their
own official-source review.

## Safety boundaries

Normal seed adds only source version 2 provenance. It never inserts provisions, requirements,
drafts, real RuleVersions or real PackVersions. Candidate import requires explicit editorial and
ephemeral guards, refuses production and accepts no bypass arguments. The import integration test
runs inside a transaction that is deliberately rolled back.

The future extraction contract is documentation only:

```text
OfficialDocumentArtifact
→ ProvisionDraftProposal[]
→ RequirementDraftProposal[]
→ RuleDraftProposal[]
→ human technical review
→ human legal review
```

No LLM extraction call is implemented.
