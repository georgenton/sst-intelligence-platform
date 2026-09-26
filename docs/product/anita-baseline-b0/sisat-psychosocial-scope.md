# SISAT y Psicosocial — alcance B0

**Fuente revisada:** `Reglamento de los Servicios Integrales de Salud en el Trabajo - SISAT (2)-1.pdf`, 32 páginas, suministrado localmente. Se hizo inspección visual de la tabla de componentes (páginas PDF 15–17) y de la tabla de categorías (página PDF 18), además de extracción de texto para los artículos citados. El repositorio, sin embargo, conserva `EC_MSP_00004_2026_SISAT` como `OFFICIAL_REFERENCE_ONLY`, sin huella del artefacto exacto; por eso este documento es alcance de revisión, no publicación normativa.

## Qué describe el documento

La Tabla 1 del artículo 15 organiza el servicio en diez componentes: orientación y planificación; recopilación y análisis de condiciones de trabajo y salud; comunicación y capacitación; prevención de peligros y riesgos; accidentes; preparación ante emergencias; enfermedades profesionales; cuidado general; registros; y seguimiento/evaluación. La tabla separa responsabilidad profesional de apoyo técnico. Esa separación se conserva como dependencia organizacional y no como autorización para exponer datos clínicos.

La Tabla 2 del artículo 16 agrupa la dotación por tamaño y riesgo. Las categorías visibles son: I para micro/pequeña empresa de riesgo medio/alto con 1–24 personas; II para pequeña empresa de riesgo medio/alto con 25–49; III para mediana A con 50–99; IV para mediana B con 100–199; y V para grande con 200 o más. La nota bajo la tabla indica que una organización menor de 50 con riesgo alto usa la categoría III. La nomenclatura “mediana A/B” y la nota de riesgo deben permanecer explícitas hasta la revisión profesional; no se convierten en un selector automático en B0.

Los artículos 17–19 diferencian independencia y credenciales de profesionales de salud, apoyos adicionales para la categoría V y la periodicidad mínima de visitas. En categorías I–III se expresa un mínimo mensual por trabajador; en IV–V se requiere cobertura permanente de jornada y turnos. El valor mensual no se interpreta como consulta clínica individual ni se asigna a una ficha de trabajador.

Los artículos 27–28 describen el ciclo anual participativo y la revisión/aprobación del plan de salud en el trabajo. El artículo 32.7 delimita el certificado de salud en el trabajo: es el resultado comunicable de las evaluaciones y no contiene diagnósticos específicos; es el único documento que puede recibir personal externo a los SISAT. El artículo 35 ubica al psicólogo en identificación/intervención de riesgos psicosociales, promoción y seguimiento. El artículo 39 exige registros de salud personales confidenciales. Los artículos 44–45 exigen confidencialidad, informes estadísticos anonimizados y custodia médica; la inspección recibe certificado de salud, no historia clínica.

## Frontera de datos para el producto

- **Coordinación preventiva no clínica:** centros, actividades, riesgos, capacitaciones, emergencias, acciones, derivaciones y evidencias de proceso.
- **Salud ocupacional protegida:** certificados y registros custodiados por el equipo autorizado según la norma; no se replica en `Worker`, notas de inspección o panel de `ORG_ADMIN`.
- **Atención clínica individual:** fuera del producto SST operativo B0. No se simula diagnóstico, consulta ni recomendación clínica.
- **Psicosocial organizacional:** puede planificar campañas, responsables, acciones y seguimiento agregado; requiere fuente técnica específica, instrumento aprobado y control de acceso antes de activarse.

## Decisiones de implementación futura

1. Tratar SISAT como una capacidad de siguiente alcance hasta fijar el PDF oficial exacto en el corpus, su hash, derechos de uso, versión y revisión profesional.
2. Modelar componentes, categorías, responsables y evidencia como referencias versionadas; no codificar los rangos en la UI sin una decisión por unidad.
3. Mantener la asociación entre centro, actividad, población asignada y cobertura de turnos; no usar presencia puntual como único denominador.
4. Separar datos de prevención y coordinación de cualquier dato clínico individual; las rutas administrativas no deben devolver historiales.
5. Para Psicosocial, probar primero un flujo de planificación y seguimiento agregado, con autorización explícita y sin autoactivar `ModuleKey.PSYCHOSOCIAL`.

## Ambigüedades preservadas

- La fuente local y su entrada de Registro Oficial no están aún enlazadas por una huella común en el repositorio.
- La tabla de categorías tiene una nota que cruza tamaño, riesgo y categoría; la regla para organizaciones menores de 50 con riesgo alto requiere una decisión editorial visible.
- El artículo 18 presenta umbrales de profesionales adicionales para 201–499, 500–799, 800–1099 y 1100–1399; la composición y el glifo del documento deben verificarse contra el artefacto oficial antes de extraer números.
- La relación entre el programa psicosocial citado en el piloto MDT-2024-196 y la fuente técnica concreta sigue pendiente; el manifiesto conserva esa dependencia sin inventarla.

## Estado B0

`SISAT=NEXT_SCOPE`, `PSYCHOSOCIAL=NEXT_SCOPE`, `REAL_REGULATORY_RULES_PUBLISHED=0`. No se modificaron rutas, Prisma, entitlements ni contratos para esta nota.
