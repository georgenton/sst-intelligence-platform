# Matriz de fundamento jurídico R1.1

| Hecho y alcance                                                               | Jurisdicción             | Estado                       | Fuente y unidades                                        | Interpretación permitida                                                                   |
| ----------------------------------------------------------------------------- | ------------------------ | ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `organization.totalWorkerCount`                                               | `EC`                     | `VERIFIED`                   | `EC_MDT_2024_196`, Artículos 18, 19 y 20                 | Explica que la norma diferencia la gestión SST por cantidad; no calcula cumplimiento.      |
| `workCenter.workerCount`                                                      | `EC`                     | `VERIFIED`                   | `EC_MDT_2024_196`, Artículo 13                           | Señala que la cifra participa en la determinación; exige considerar riesgo y otros hechos. |
| `workCenter.hasElectricalWorkOrExposure`                                      | `EC`                     | `VERIFIED`                   | `EC_MDT_2024_196_ANNEX_3`, Capítulo III, Artículos 82–90 | Cribado de aplicabilidad eléctrica; no declara obligación ni incumplimiento.               |
| `workCenter.highEnergySourceTypes` con alta energía confirmada y `ELECTRICAL` | `EC`                     | `VERIFIED`                   | `EC_MDT_2024_196_ANNEX_3`, Capítulo III, Artículos 82–90 | Muestra el fundamento del cribado después de confirmar el tipo de fuente.                  |
| `workCenter.highEnergySourceTypes` con alta energía pero sin tipo confirmado  | `EC`                     | `CONTEXT_REQUIRED`           | Ninguna                                                  | Pide el dato técnico antes de seleccionar una fuente.                                      |
| Cualquier otro hecho                                                          | `EC`                     | `NO_DIRECT_LEGAL_BASIS`      | Ninguna                                                  | Conserva contexto operativo sin atribuir una obligación legal.                             |
| Cualquier hecho                                                               | `CO` u otra jurisdicción | `JURISDICTION_NOT_SUPPORTED` | Ninguna                                                  | La evaluación continúa; no se muestra ni se infiere ley extranjera.                        |
| Cualquier hecho                                                               | País desconocido         | `CONTEXT_REQUIRED`           | Ninguna                                                  | Solicita confirmar el país.                                                                |

Las unidades, identificadores de versión, huellas SHA-256 y URLs oficiales se
toman del corpus de referencia canónico. `RuleVersion` permanece en cero y no
se publica una regla a partir de esta matriz.
