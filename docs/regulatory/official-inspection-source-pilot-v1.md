# Official Inspection Source Pilot V1

Status: engineering/reference pilot closed in production on 2026-09-02. Professional approval is
**PENDING ANITA**.

| Candidate                      | Jurisdiction                               | Domain                      | Classification                         | Content boundary                                                                         |
| ------------------------------ | ------------------------------------------ | --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| RETIE                          | Colombia (`CO`)                            | Electrical                  | Foreign technical regulation reference | Metadata and small platform-authored pilot criteria                                      |
| REBT, Real Decreto 842/2002    | Spain (`ES`)                               | Electrical                  | Foreign technical regulation reference | Official BOE locator and bounded authored criteria                                       |
| RTQ                            | Distrito Metropolitano de Quito (`EC-UIO`) | Fire / chemical storage     | Local official regulation reference    | Official Quito locator and bounded authored criteria                                     |
| CLP, Regulation (EC) 1272/2008 | European Union (`EU`)                      | Chemical storage            | Foreign regulation reference           | Metadata only in V1                                                                      |
| NFPA 70E / family              | United States (`US`)                       | Future electrical reference | Proprietary standard, reference only   | Official NFPA locator; no full text, criteria, reconstructed tables or compliance claims |

## Source and reuse policy

Only official Ministry, BOE, Cuerpo de Bomberos Quito and EUR-Lex locators are accepted. Metadata,
jurisdiction, official locator and artifact digest may be stored. Full documents are not ingested
merely because they are public; no proprietary standard text is copied. Pilot criteria are short,
original platform-authored checks and are visibly labeled `PILOTO / REQUIERE REVISIÓN PROFESIONAL`.

The NFPA entry is deliberately `REFERENCE_ONLY`, remains `DRAFT`, and stores only bibliographic
metadata plus the official NFPA LiNK locator. It contributes no executable criterion or copied
standard content.

RETIE, REBT and CLP are never presented as Ecuadorian law. RTQ is never generalized beyond Quito.
No source is represented as selected or approved by Anita.

## Verified official provenance

- **RETIE:** Ministerio de Minas y Energía de Colombia, official RETIE page. The current page
  identifies **Resolución 40284 del 23 de junio de 2026** as the latest modification and publishes
  the regulation in four books. The pilot stores the official page locator and metadata only; it
  does not ingest the books.
- **REBT:** **Real Decreto 842/2002**, BOE-A-2002-18099, Spain. BOE labels its consolidated text as
  informational and without legal value of its own; the pilot does not claim Ecuador applicability.
- **RTQ:** Cuerpo de Bomberos del Distrito Metropolitano de Quito, official Normativa Técnica page,
  RTQ 1 and RTQ 4 under Resolución ADMQ 017-2026. Its boundary is `EC-UIO`, not national Ecuador.
- **CLP:** Regulation (EC) No 1272/2008, CELEX 32008R1272. V1 stores metadata only and exposes no
  executable criterion.

## Executable pilot criteria inventory

All wording below is original platform-authored safety wording, not an official quotation. The
locator identifies the source context used for professional review; it does not turn the wording
into a legal requirement.

| Source | Code                         | Short title                                              | Source locator                                           | Wording           |
| ------ | ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ----------------- |
| RETIE  | `RETIE-PILOT-ENCLOSURE`      | Cerramientos íntegros y sin partes energizadas expuestas | Official RETIE page · Resolución 40284, 23 June 2026     | Platform-authored |
| RETIE  | `RETIE-PILOT-IDENTIFICATION` | Identificación operativa visible                         | Official RETIE page · Resolución 40284, Book 3 reference | Platform-authored |
| REBT   | `REBT-PILOT-PROTECTION`      | Protecciones identificadas y accesibles                  | BOE-A-2002-18099 · informational consolidated text       | Platform-authored |
| REBT   | `REBT-PILOT-VISIBLE-DAMAGE`  | Ausencia de daño material visible                        | BOE-A-2002-18099 · informational consolidated text       | Platform-authored |
| RTQ    | `RTQ1-PILOT-ACCESS`          | Acceso visible a controles de respuesta                  | Bomberos Quito · Normativa Técnica · RTQ 1               | Platform-authored |
| RTQ    | `RTQ4-PILOT-IDENTIFICATION`  | Identificación de áreas con materiales peligrosos        | Bomberos Quito · Normativa Técnica · RTQ 4               | Platform-authored |

Counts: RETIE=2, REBT=2, RTQ=2, CLP=0.

## Production closure evidence

The PR #34 production smoke exposed RETIE, REBT and RTQ only through the
`InspectionStandardSource` reference catalog with explicit jurisdiction and professional-review
labels. CLP remained metadata-only and NFPA remained reference-only with no executable criteria or
stored full text. None of these entries was inserted into the Ecuador regulatory corpus: its
baseline remains 15 sources, 25 versions, 1112 units, 893 ARTICLE units, 5 candidate Requirements,
5 candidate RuleDrafts and 0 real published rules.

The smoke configured RETIE and REBT as technical sources without a legal-context unit. It did not
claim Ecuadorian applicability, nationalize RTQ, certify compliance or record an Anita decision.
