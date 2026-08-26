import type {
  RegulatoryCandidateStatus,
  RegulatoryDocumentType,
  RegulatoryRelationshipReviewStatus,
  RegulatoryRelationshipType,
  RegulatorySupersessionStatus,
} from '@sst/contracts';

export const REGULATORY_SOURCE_BOUNDARY_COPY =
  'Estar registrada como fuente no significa que esta norma aplique a una organización ni que el sistema haya convertido su contenido en reglas.';

export const regulatoryDocumentTypeLabels: Record<RegulatoryDocumentType, string> = {
  MINISTERIAL_AGREEMENT: 'Acuerdo ministerial',
  ANNEX: 'Anexo',
  EXECUTIVE_DECREE: 'Decreto ejecutivo',
  CODE: 'Código',
  RESOLUTION: 'Resolución',
  REGULATION: 'Reglamento',
  OTHER: 'Otro / referencia no verificada',
};

export const regulatoryCandidateStatusLabels: Record<RegulatoryCandidateStatus, string> = {
  DISCOVERED: 'Fuente candidata descubierta',
  OFFICIAL_DOCUMENT_LOCATED: 'Documento oficial localizado',
  SUPERSESSION_REVIEW_REQUIRED: 'Revisión de relación pendiente',
  TECHNICAL_REVIEW_PENDING: 'Revisión técnica pendiente',
  LEGAL_REVIEW_PENDING: 'Revisión jurídica pendiente',
  APPROVED_FOR_EXTRACTION: 'Aprobada para extracción',
  APPROVED_FOR_RULES: 'Aprobada editorialmente para reglas',
  SUPERSEDED: 'Marcada editorialmente como superada',
  REJECTED_REFERENCE: 'Referencia no verificada',
};

export const regulatorySupersessionStatusLabels: Record<RegulatorySupersessionStatus, string> = {
  UNKNOWN_REVIEW_REQUIRED: 'Revisión de relación/vigencia pendiente',
  CURRENT_VERSION_NOT_ESTABLISHED: 'Versión actual no establecida',
  UNVERIFIED_REFERENCE: 'Referencia no verificada',
  RELATION_REVIEW_REQUIRED: 'Relación pendiente de revisión formal',
  NO_KNOWN_RELATION_RECORDED: 'Sin relación conocida registrada',
};

export const regulatoryRelationshipTypeLabels: Record<RegulatoryRelationshipType, string> = {
  POSSIBLE_SUPERSESSION: 'Posible sucesión',
  POSSIBLE_AMENDMENT: 'Posible reforma',
  POSSIBLE_REPLACEMENT: 'Posible reemplazo',
  RELATED_REFERENCE: 'Referencia relacionada',
};

export const regulatoryRelationshipReviewStatusLabels: Record<
  RegulatoryRelationshipReviewStatus,
  string
> = {
  PENDING_REVIEW: 'Relación pendiente de revisión formal',
  CONFIRMED: 'Relación revisada',
  REJECTED: 'Relación descartada',
};

export type RegulatorySourceFilters = {
  q: string;
  issuer: string;
  documentType: '' | RegulatoryDocumentType;
  candidateStatus: '' | RegulatoryCandidateStatus;
};

export function regulatorySourceQueryString(filters: RegulatorySourceFilters) {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.issuer.trim()) params.set('issuer', filters.issuer.trim());
  if (filters.documentType) params.set('documentType', filters.documentType);
  if (filters.candidateStatus) params.set('candidateStatus', filters.candidateStatus);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function formatCatalogDate(value: string | null) {
  if (!value) return 'No establecida';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(value),
  );
}
