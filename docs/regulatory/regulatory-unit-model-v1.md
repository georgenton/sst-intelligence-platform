# Regulatory Unit Model V1

`RegulatoryUnit` representa una unidad textual ligada a una única `RegulatorySourceVersion`. Admite
`TITLE`, `CHAPTER`, `SECTION`, `ARTICLE`, disposiciones generales/transitorias/derogatorias/finales,
anexos e items auxiliares. La jerarquía usa `parentUnitId`; `ordinal` conserva el orden documental.

Cada registro contiene identificador estructural, encabezado opcional, `officialText`,
`normalizedTextHash`, páginas, localizador y estados de extracción/revisión. `editorialSummary` es un
campo distinto: jamás reemplaza ni se mezcla con el texto oficial.

## Invariantes

- La combinación versión/identificador es única y el orden es estable.
- El padre, cuando existe, pertenece a la misma versión.
- Texto obligatorio, páginas y localizador son validados por contrato y base de datos.
- El hash es SHA-256 de una normalización conservadora de saltos y espacios; no se reconstruye texto.
- Una unidad `VERIFIED` de una versión oficial verificada no admite update ni delete.
- Un cambio oficial exige otra `RegulatorySourceVersion` y otro conjunto de unidades.
- Provision y Requirement enlazan unidades exactas mediante `RegulatoryProvisionUnit`.

La migración activa checks y triggers de PostgreSQL para estas garantías. El sincronizador compara
identidad, texto y hash; una diferencia sobre una identidad estable aborta con drift en vez de
sobrescribir historia.
