# Regulatory Library UX V1

La ruta autenticada `Configuración SST → Biblioteca normativa` permite buscar fuentes por documento,
número o emisor, abrir metadata/versiones y navegar el catálogo de artículos. La búsqueda usa
PostgreSQL con coincidencia ordinaria; no usa vectores, RAG ni LLM.

La página de fuente muestra título, emisor, número, publicación, vigencia, estado de verificación y
enlace oficial. Una fuente sin texto completo conserva su metadata y muestra el estado pendiente;
no construye artículos artificiales.

La página de artículo separa dos bloques visibles:

1. **Texto oficial**: identificador, encabezado, texto, artefacto/verificación, versión, páginas,
   localizador y enlace oficial.
2. **Interpretación en la plataforma**: sin estructurar, candidata, pendiente, revisada o aprobada
   editorialmente.

La UI primaria usa lenguaje humano. UUID, hashes, fact keys y predicados quedan en trazas técnicas.
Ninguna pantalla presenta un match como conclusión legal ni combina evidencia de fuente,
organización y verificación de riesgo.
