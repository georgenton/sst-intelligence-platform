# Ecuador SST multi-source review corpus V1

## Purpose and boundary

This increment expands the controlled MDT-2024-196 pilot into review infrastructure for an SST
expert session. It imports stable source identities and immutable provenance versions, suggests
documents for human review and records unresolved relationships. It does not publish an
applicability pack, extract mass legal content or create production legal rules.

The controlling rule is: import many documents, interpret few and publish none. A review-map entry
means “source proposed for review”, never “applicable law”. The router is CLI/artifact tooling only;
it has no API route and cannot create configuration items, obligations, applicability states or
review depth.

## Verification log

| Source                       | Verification                        | Artifact                          | Extraction | Rules |
| ---------------------------- | ----------------------------------- | --------------------------------- | ---------- | ----- |
| MDT-2024-196                 | Official reference verified         | Official PDF fingerprint verified | Ready      | No    |
| MDT-2024-196 Annex 1         | Official reference verified         | Official PDF fingerprint verified | Ready      | No    |
| MDT-2024-196 Annex 2         | Official artifact verified          | Official PDF fingerprint verified | Pending    | No    |
| MDT-2024-196 Annex 3         | Official artifact verified          | Official PDF fingerprint verified | Pending    | No    |
| Executive Decree 255         | Official artifact verified          | Official PDF fingerprint verified | Pending    | No    |
| Labor Code                   | Official reference verified         | Official PDF fingerprint verified | Ready      | No    |
| CAN Decision 584             | Official reference verified         | Official PDF fingerprint verified | Ready      | No    |
| CAN Resolution 957           | Official reference verified         | Official PDF fingerprint verified | Ready      | No    |
| MSP 00004-2026 SISAT         | Official publication reference only | Exact artifact unavailable        | No         | No    |
| MDT-2025-122 Construction    | Official reference verified         | Official PDF fingerprint verified | Ready      | No    |
| IESS C.D. 513                | Official artifact verified          | Official PDF fingerprint verified | Pending    | No    |
| IESS C.D. 692                | Official reference verified         | Official PDF fingerprint verified | Ready      | No    |
| IESS C.D. 517                | Official artifact verified          | Official PDF fingerprint verified | Pending    | No    |
| IESS C.D. 677                | Official reference verified         | Official PDF fingerprint verified | Ready      | No    |
| C.D. 527 interview reference | Unverified reference                | Not located                       | No         | No    |

The live Ministry of Labour SST catalog was rechecked before authoring and still lists the Labor
Code, Executive Decree 255, MDT-2024-196, Annexes 1/2/3, Decision 584 and Resolution 957. Registro
Oficial confirms MDT-2025-122 in Fourth Supplement No. 127 dated 18 September 2025 and SISAT
00004-2026 in Second Supplement No. 304 dated 12 June 2026.

Every retrievable artifact was downloaded into a temporary directory, checked for HTTP success,
PDF MIME, bounded byte size, title/reference and SHA-256, then deleted. The repository stores only
metadata and fingerprints; it stores no PDF, DOCX, OCR or full legal text. CI performs no government
network fetch.

## Relationship safety

C.D. 692 to C.D. 513 is recorded through the closest existing model: `POSSIBLE_AMENDMENT` with a
confirmed review status and an explicit note that C.D. 692 reforms article 46. No consolidated legal
text is synthesized.

C.D. 517 and C.D. 677 stay separate. Their relationship is confirmed because the Disposición
Derogatoria Única of C.D. 677 expressly repeals the regulation contained in C.D. 517. C.D. 517 is
retained as historical and `REPEALED`; the broader currentness of C.D. 677 stays pending. The C.D.
527 interview reference stays visible as rejected provenance and cannot be extracted or used for
rules.

## Structured-content boundary

Only MDT-2024-196 articles 18 and 19 retain the existing two provision candidates, five requirement
candidates and five rule drafts inside the isolated editorial pilot. The other fourteen sources add
zero provisions, requirements, rule drafts or rule versions. All corpus sources remain
`readyForRules=false`; production seed contains zero regulatory provisions, zero regulatory
requirements and zero real regulatory rule or pack versions.

## Expert artifacts

`pnpm regulatory:review-corpus` validates corpus version `1.0.0`, rejects same-version canonical
drift, exercises the internal review router and generates ignored Anita artifacts. The consolidated
document is `.artifacts/regulatory-pilot/ANITA_MULTI_SOURCE_REVIEW_V1.md`. It includes the source
coverage table, three scenario review maps, missing-document capture, document relationships and
blank expert decision fields.
