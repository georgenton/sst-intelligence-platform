# Gates de fuentes B3A / B3.1

La implementación operativa B3A está terminada y separada de la base regulatoria B3.1. Este
documento conserva el bloqueo de provenance de SISAT; no lo convierte en una capacidad de B3A.

## SISAT

`EC_MSP_00004_2026_SISAT` permanece `OFFICIAL_REFERENCE_ONLY` para B3.1. La página oficial
del [Segundo Suplemento No. 304](https://www.registroficial.gob.ec/segundo-suplemento-no-304/)
confirma la publicación, la fecha (12 de junio de 2026) y el Acuerdo MSP 00004-2026. En
esta última comprobación se inspeccionó el HTML de la página, sus enlaces e imágenes y se
consultaron los endpoints públicos de medios del mismo dominio; la página no expone una
descarga de la edición completa y los endpoints responden con acceso no autorizado. No se
aceptó ningún mirror ni URL de terceros como artefacto. El PDF local de B0 tampoco es
autoridad. Por eso no se extrajeron artículos, categorías, horas ni obligaciones SISAT. Para
desbloquear B3.1 hace falta uno de estos artefactos oficiales: (A) el PDF completo del Segundo
Suplemento No. 304 servido desde el dominio/repositorio oficial, o (B) el artefacto específico
MSP 00004-2026 servido desde `salud.gob.ec` u otro repositorio oficial. Después deben fijarse
hash, bytes, páginas, unidades y revisión.

## Psicosocial

Los seis artefactos se localizaron en el [índice oficial del Ministerio del Trabajo](https://www.trabajo.gob.ec/normativa-legal-programas-formatos-y-guias/)
y se fijaron como metadatos verificables. Sus hashes y tamaños viven en el corpus de revisión;
la aplicación no copia respuestas individuales ni interpreta las hojas automáticamente.

| Artefacto                                           | Tipo                                                              | Estado     |
| --------------------------------------------------- | ----------------------------------------------------------------- | ---------- |
| Cuestionario de Evaluación de Riesgos Psicosociales | `ASSESSMENT_TOOL` editorial, `OTHER` en el catálogo actual        | Verificado |
| Guía para la aplicación del cuestionario            | `QUESTIONNAIRE_GUIDANCE` editorial, `OTHER` en el catálogo actual | Verificado |
| Guía para la implementación del programa            | `GUIDANCE` editorial, `OTHER` en el catálogo actual               | Verificado |
| Herramienta para tabulación                         | `ASSESSMENT_TOOL` editorial, `OTHER` en el catálogo actual        | Verificado |
| Programa de Prevención Riesgos Psicosociales        | `PROGRAM_TEMPLATE` editorial, `OTHER` en el catálogo actual       | Verificado |
| Manual de Registro de Programas de Prevención       | `REGISTRATION_MANUAL` editorial, `OTHER` en el catálogo actual    | Verificado |

La clasificación editorial no convierte una guía o una hoja de cálculo en una obligación
jurídica. La fuente del cuestionario se vincula únicamente a su `RegulatorySourceVersion`
oficial verificado. El programa psicosocial no se asocia automáticamente a Art. 19: la UI
solo muestra MDT-2024-196 cuando la jurisdicción es Ecuador y el perfil SST versionado contiene
un `organization.workerCount` canónico mayor que 10. Con 1–10, país desconocido o una
jurisdicción no soportada se muestra el estado de contexto correspondiente y no se filtra una
norma ecuatoriana. No se publica la regla `MDT_2024_196_PSYCHOSOCIAL_PROGRAM_GT_10_RULE`.
