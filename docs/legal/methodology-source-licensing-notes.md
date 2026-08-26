# Methodology source licensing notes

## GTC 45 — 2010 first update

- Local input: user-provided `gtc-45-2010.pdf`.
- SHA-256: `99a387729fd3a73a93dbc06a44ac5be0a7eedd8999f26b709c0cbf794f823973`.
- The document visibly states a reproduction prohibition.
- The PDF and extracted full text are not committed.
- Product/repository material is limited to metadata, fingerprint, numeric constants, short labels,
  paraphrased explanations, source/table locators and a licensing notice.
- `officialUrl` remains null because an issuer-hosted official copy was not independently verified.

Required UI notice:

> Contenido metodológico resumido; texto fuente sujeto a derechos del emisor.

## Corporate 5×5 workbook

- Local input: user-provided workbook used only as structural inspiration.
- SHA-256: `ef6423b6a2017c76e961902d90dbe6aa2b65dc0567eaeab276a3e82722bf2a8c`.
- It contains organization-specific business wording and financial thresholds.
- No company name, corporate wording or USD threshold is committed as a generic default.
- The runtime retains only generic concepts: multiple impact dimensions, history, exposure, control
  coverage/failure and human dependency.
- Future organization-defined thresholds must be tenant-scoped and versioned.

## Expert-session evidence

The implementation workspace did not contain a separate SST expert-session transcript that could
be fingerprinted. Statements supplied in the authorization are therefore recorded as
`EXPERT_OBSERVATION`, with review pending. They are not silently promoted to technical or legal
approval.

## Publication rule

A source fingerprint and published method version are immutable. A corrected source edition or
algorithm creates a new source/method version. Historical assessment snapshots never point to a
replacement version.
