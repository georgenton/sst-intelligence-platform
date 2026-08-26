# Official source verification

## Pinned evidence

- Source key: `EC_MDT_2024_196`
- Catalog version: `2`
- Official document: Ministry of Labour signed PDF
- SHA-256: `sha256:4fe2da2ddf2b730c0c9e56e321d5a817f94b98d6d9f9e02bb97c18f2cc47473d`
- MIME: `application/pdf`
- Bytes: `459819`
- Publication: Cuarto Suplemento al Registro Oficial No. 691, 26 November 2024

The optional command `pnpm regulatory:verify-official-source -- EC_MDT_2024_196` performs a manual
network verification. It checks HTTPS allowlisted hosts, DNS results against private addresses,
credentials and ports, every redirect, timeouts, response-size limits, MIME, bytes, SHA-256,
embedded text title/article locators and Registro Oficial metadata. It does not use OCR.

The verifier is internal CLI code and is not reachable from NestJS routes. Normal CI is offline and
uses the committed metadata. A different document fingerprint produces
`SOURCE_ARTIFACT_DRIFT_DETECTED`; catalog version 2 is never overwritten and a human must decide
whether a new source version is required.

The repository stores neither the official PDF nor its full extracted text.
