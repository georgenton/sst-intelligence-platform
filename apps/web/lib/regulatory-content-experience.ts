import type {
  RegulatoryProvisionEditorialStatus,
  RegulatoryProvisionLocatorType,
  RegulatoryRequirementEditorialStatus,
  RegulatoryRequirementRelationshipType,
  RegulatoryRequirementScopeHint,
} from '@sst/contracts';

export const REGULATORY_CONTENT_BOUNDARY_COPY =
  'El contenido estructurado identifica material revisado dentro de la plataforma. No decide si aplica a una organización, si constituye una obligación exigible ni si existe cumplimiento.';

export const REGULATORY_CONTENT_EMPTY_COPY =
  'El contenido de esta fuente todavía no ha sido estructurado y revisado dentro de la plataforma. Esto no significa que no existan requisitos legales.';

export const regulatoryProvisionLocatorTypeLabels: Record<RegulatoryProvisionLocatorType, string> =
  {
    ARTICLE: 'Artículo',
    SECTION: 'Sección',
    NUMERAL: 'Numeral',
    ANNEX: 'Anexo',
    TABLE: 'Tabla',
    OTHER: 'Otro localizador',
  };

export const regulatoryProvisionStatusLabels: Record<RegulatoryProvisionEditorialStatus, string> = {
  DRAFT: 'Borrador editorial',
  EXTRACTED: 'Contenido identificado',
  TECHNICAL_REVIEW_PENDING: 'Revisión técnica pendiente',
  LEGAL_REVIEW_PENDING: 'Revisión jurídica pendiente',
  APPROVED: 'Revisada y aprobada',
  REJECTED: 'Descartada editorialmente',
  SUPERSEDED: 'Reemplazada editorialmente',
};

export const regulatoryRequirementStatusLabels: Record<
  RegulatoryRequirementEditorialStatus,
  string
> = {
  DRAFT: 'Borrador editorial',
  TECHNICAL_REVIEW_PENDING: 'Revisión técnica pendiente',
  LEGAL_REVIEW_PENDING: 'Revisión jurídica pendiente',
  APPROVED_FOR_RULE_DRAFTING: 'Listo para redactar regla',
  REJECTED: 'Descartado editorialmente',
  SUPERSEDED: 'Reemplazado editorialmente',
};

export const regulatoryRequirementScopeHintLabels: Record<RegulatoryRequirementScopeHint, string> =
  {
    UNKNOWN: 'Por determinar',
    ORGANIZATION: 'Organización',
    WORK_CENTER: 'Centro de trabajo',
    AREA_PROCESS: 'Área o proceso',
    ACTIVITY: 'Actividad',
    ASSET: 'Equipo o activo',
    MULTI_SCOPE: 'Varios niveles posibles',
  };

export const regulatoryRequirementRelationshipTypeLabels: Record<
  RegulatoryRequirementRelationshipType,
  string
> = {
  PRIMARY_SOURCE: 'Fuente principal',
  SUPPORTING_SOURCE: 'Fuente de apoyo',
  RELATED_SOURCE: 'Fuente relacionada',
};
