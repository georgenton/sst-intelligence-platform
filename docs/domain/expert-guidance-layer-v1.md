# Expert Guidance Layer V1

## Purpose

Expert guidance supplements a method without altering its canonical formula. It is versioned,
reviewable and disclosed separately from source, regulatory context, method and assessment.

An expert statement is product-discovery evidence. It is not a regulatory rule, technical approval
or legal approval.

## Contract

`RiskMethodExpertGuidanceVersion` records:

- method-version reference;
- guidance identity/version;
- author/source classification;
- review status;
- question/help definitions;
- explicit non-scoring flag per help definition;
- disclaimer and content hash.

Published guidance is immutable. A change produces a new guidance version without changing the
method version or historical assessment snapshot.

## Anita Guidance GTC45 V1

`ANITA_GUIDANCE_GTC45_V1@1.0.0` is CANDIDATE and PENDING. It asks the evaluator to think about:

- conditions at the hazard source;
- environment/medium conditions;
- individual/person context without blame or diagnosis;
- control coverage/effectiveness evidence;
- event/exposure history;
- recurring observed failures.

It does not assign ND, claim root cause, select acceptability or modify NP/NR. The separate source
transcript was not available in the implementation workspace, so the supplied claim remains
`EXPERT_OBSERVATION` pending direct expert confirmation.

## SUT observation

The interview claim that SUT offers “5×5 / GTC45 / Other” is stored only as an expert observation.
No current official SUT artifact was located that verifies the live options.

`OFFICIAL_SUT_METHOD_OPTIONS=PENDING`.
