# Ecuador SST multi-source review corpus V1

This manifest is review infrastructure, not a published applicability pack. It records official
provenance, document fingerprints, unresolved relationships and sources suggested for expert
review. Only the existing MDT-2024-196 Articles 18/19 pilot has structured candidates.

The corpus follows three rules: import many documents, interpret few and publish none. A suggested
source means “consider reviewing this document”; it never means that the document applies to the
scenario. Every source remains `readyForRules=false`.

Official documents are not stored in the repository. Verified artifacts were downloaded only to a
temporary directory to check HTTP, PDF MIME, byte size, title/reference and SHA-256, then discarded.
The repository contains only metadata and fingerprints. Normal validation is offline.

`corpus.json` pins version `1.0.0` and the canonical material hash. Reusing that version with changed
source, relationship or scenario content is rejected. `relationships.json` contains only traceable
document relationships; pending relationships do not establish legal hierarchy or supersession.

Run `pnpm regulatory:review-corpus` to validate the corpus and generate the ignored Anita review
artifacts. No command contacts government sites unless the separate manual source verifier is
explicitly invoked.
