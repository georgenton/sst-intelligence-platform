import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  COPILOT_PRODUCT_CAPABILITIES,
  COPILOT_PROHIBITED_AUTHORITIES,
  PORTFOLIO_CONTEXT_TYPE,
  PORTFOLIO_READ_ACTIONS,
  portfolioCitationsAreAuthorized,
  portfolioCopilotRequestSchema,
  type PortfolioCitation,
  type PortfolioContextResult,
  type PortfolioReadAction,
} from '@sst/contracts';
import { INCIDENTS_FEATURE_KEY } from '../catalog/entitlement';
import {
  CONVERSATIONAL_ASSISTANT_PROVIDER,
  type ConversationalAssistantProvider,
} from '../conversational-operations/conversational-assistant.provider';
import { ConsultantPortfolioService, type PortfolioWorkItem } from './consultant-portfolio.service';
import type { PortfolioCopilotRequestDto } from './dto';

type PortfolioSnapshot = Awaited<ReturnType<ConsultantPortfolioService['get']>>;

@Injectable()
export class PortfolioCopilotService {
  constructor(
    private readonly portfolio: ConsultantPortfolioService,
    @Inject(CONVERSATIONAL_ASSISTANT_PROVIDER)
    private readonly provider: ConversationalAssistantProvider,
  ) {}

  status() {
    return {
      ...this.provider.descriptor,
      label:
        this.provider.descriptor.mode === 'DETERMINISTIC_LOCAL'
          ? 'Procesamiento local controlado · sin IA externa'
          : 'Proveedor generativo configurado por el servidor',
      providerSelection: 'PENDING_EXTERNAL_PRODUCT_DECISION',
      context: PORTFOLIO_CONTEXT_TYPE,
      supportedCapabilities: COPILOT_PRODUCT_CAPABILITIES,
      prohibitedAuthorities: COPILOT_PROHIBITED_AUTHORITIES,
      readActions: PORTFOLIO_READ_ACTIONS,
      materialWrites: 'SINGLE_ORGANIZATION_CONTEXT_AND_CONFIRMATION_REQUIRED',
    };
  }

  async query(userId: string, rawInput: PortfolioCopilotRequestDto) {
    const parsed = portfolioCopilotRequestSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_PORTFOLIO_COPILOT_REQUEST',
        message: parsed.error.issues[0]?.message ?? 'La consulta no es válida.',
      });
    }
    const input = parsed.data;
    const organizations = await this.portfolio.authorizedOrganizationSet(userId);
    const authorizedIds = organizations.map(({ id }) => id);
    const normalized = this.normalize(input.content);
    const uuidReferences = input.content.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    );
    if (
      (input.organizationId && !authorizedIds.includes(input.organizationId)) ||
      uuidReferences?.some((id) => !authorizedIds.includes(id))
    ) {
      return this.boundary(
        'NOT_AUTHORIZED',
        'La organización solicitada no forma parte de tu acceso activo actual.',
      );
    }
    if (
      this.includesAny(normalized, [
        'ignora instrucciones',
        'ignore previous instructions',
        'invent citation',
        'invented-citation',
        'inventa una cita',
        'delete_organization',
        'herramienta no soportada',
      ])
    ) {
      return this.boundary(
        'NOT_AUTHORIZED',
        'La solicitud intenta ampliar permisos, fuentes o herramientas y fue rechazada.',
      );
    }
    if (
      this.includesAny(normalized, [
        'conclusion legal final',
        'cumplimiento legal',
        'decision final de riesgo',
        'aprueba el riesgo',
        'causa raiz',
        'trabajador inseguro',
        'puntaje de seguridad',
      ])
    ) {
      return this.boundary(
        'PROFESSIONAL_REVIEW_REQUIRED',
        'Esa conclusión requiere revisión profesional; el Copilot no decide cumplimiento, riesgo, causa raíz ni seguridad de una persona.',
      );
    }
    if (
      this.includesAny(normalized, [
        'todas las empresas',
        'todas las organizaciones',
        'en masa',
        'mass multi-org',
      ]) &&
      this.includesAny(normalized, ['crea', 'crear', 'modifica', 'cerrar', 'asigna'])
    ) {
      return this.boundary(
        'NOT_AUTHORIZED',
        'No se permiten escrituras materiales multi-organización. Selecciona una organización y confirma allí la acción canónica.',
      );
    }
    const target = input.organizationId
      ? organizations.find(({ id }) => id === input.organizationId)
      : this.findOrganization(normalized, organizations);
    if (this.includesAny(normalized, ['crear una accion', 'crea una accion', 'nueva accion'])) {
      if (!target) {
        return this.boundary(
          'INSUFFICIENT_CONTEXT',
          'Indica una organización autorizada antes de preparar una acción.',
        );
      }
      return {
        ...this.base('ANSWERED'),
        capability: 'SUGGEST_NEXT_QUESTION',
        actionKey: null,
        summary: `La acción no fue creada. Cambia primero al contexto de ${target.name}; después usa la acción canónica con confirmación.`,
        data: null,
        citations: [this.organizationCitation(target)],
        organizationAnchor: {
          required: true,
          organizationId: target.id,
          organizationName: target.name,
          role: target.role,
          deepLink: '/app/assistant',
        },
        materialWriteExecuted: false,
      };
    }
    if (this.includesAny(normalized, ['incidente', 'incidentes']) && target) {
      if (target.features[INCIDENTS_FEATURE_KEY] !== true) {
        return this.boundary(
          'SOURCE_NOT_AVAILABLE',
          `El módulo de incidentes no está disponible para ${target.name}; no se agregó información de otra organización.`,
        );
      }
    }

    const selection = this.selectAction(normalized, target?.id);
    if (!selection) {
      return this.boundary(
        'INSUFFICIENT_CONTEXT',
        'Puedo resumir atención, acciones vencidas, señales o paquetes de evidencia de tus organizaciones autorizadas.',
      );
    }
    const snapshot = await this.portfolio.get(userId, {
      organizationId: selection.organizationId,
      dueState: selection.action === 'get_portfolio_overdue_work' ? 'OVERDUE' : 'ALL',
      pageSize: 50,
    });
    const citations = this.citations(selection.action, snapshot);
    if (!portfolioCitationsAreAuthorized(citations, authorizedIds)) {
      throw new BadRequestException({
        code: 'PORTFOLIO_CITATION_NOT_AUTHORIZED',
        message: 'La respuesta contiene una cita fuera del acceso actual.',
      });
    }
    return {
      ...this.base('ANSWERED'),
      capability: this.capability(selection.action),
      actionKey: selection.action,
      summary: this.summary(selection.action, snapshot),
      data: this.data(selection.action, snapshot),
      citations,
      organizationAnchor: null,
      materialWriteExecuted: false,
    };
  }

  private selectAction(normalized: string, organizationId?: string) {
    if (
      organizationId &&
      this.includesAny(normalized, ['por que', 'resumen', 'empresa', 'organizacion'])
    ) {
      return { action: 'get_organization_summary' as const, organizationId };
    }
    if (
      this.includesAny(normalized, ['acciones vencidas', 'trabajo vencido', 'pendientes vencidos'])
    ) {
      return { action: 'get_portfolio_overdue_work' as const, organizationId };
    }
    if (
      this.includesAny(normalized, [
        'senal',
        'senales',
        'repitiendo hallazgos',
        'hallazgos repetidos',
      ])
    ) {
      return { action: 'get_portfolio_signals' as const, organizationId };
    }
    if (this.includesAny(normalized, ['paquete', 'paquetes', 'evidencia pendiente'])) {
      return { action: 'get_portfolio_evidence_state' as const, organizationId };
    }
    if (this.includesAny(normalized, ['necesitan atencion', 'necesita atencion'])) {
      return { action: 'get_portfolio_attention' as const, organizationId };
    }
    if (this.includesAny(normalized, ['clientes', 'organizaciones', 'portafolio', 'resumen'])) {
      return { action: 'get_portfolio_summary' as const, organizationId };
    }
    return null;
  }

  private citations(action: PortfolioReadAction, snapshot: PortfolioSnapshot): PortfolioCitation[] {
    if (action === 'get_portfolio_overdue_work') {
      return snapshot.work.items.map((item) => this.workCitation(item));
    }
    if (action === 'get_portfolio_signals') {
      return snapshot.signals.map((signal) => ({
        id: `signal:${signal.organizationId}:${signal.id}`,
        organizationId: signal.organizationId,
        organizationName: signal.organizationName,
        sourceType: 'OPERATIONAL_SIGNAL',
        sourceId: signal.id,
        label: signal.title,
        deepLink: signal.deepLink,
      }));
    }
    if (action === 'get_portfolio_evidence_state') {
      return snapshot.evidence.map((item) => ({
        id: `evidence:${item.organizationId}:${item.id}`,
        organizationId: item.organizationId,
        organizationName: item.organizationName,
        sourceType: 'EVIDENCE_PACKAGE',
        sourceId: item.id,
        label: item.title,
        deepLink: item.deepLink,
      }));
    }
    return snapshot.organizations.map((item) => this.organizationCitation(item.organization));
  }

  private workCitation(item: PortfolioWorkItem): PortfolioCitation {
    return {
      id: `work:${item.organizationId}:${item.type}:${item.sourceId}`,
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      sourceType: item.type,
      sourceId: item.sourceId,
      label: item.title,
      deepLink: item.deepLink,
    };
  }

  private organizationCitation(organization: { id: string; name: string }): PortfolioCitation {
    return {
      id: `organization:${organization.id}`,
      organizationId: organization.id,
      organizationName: organization.name,
      sourceType: 'ORGANIZATION',
      sourceId: organization.id,
      label: organization.name,
      deepLink: '/app',
    };
  }

  private data(action: PortfolioReadAction, snapshot: PortfolioSnapshot) {
    if (action === 'get_portfolio_overdue_work') return snapshot.work;
    if (action === 'get_portfolio_signals') return snapshot.signals;
    if (action === 'get_portfolio_evidence_state') return snapshot.evidence;
    if (action === 'get_organization_summary') return snapshot.organizations[0] ?? null;
    if (action === 'get_portfolio_attention') {
      return snapshot.organizations.filter(({ needsAttention }) => needsAttention);
    }
    return snapshot.summary;
  }

  private summary(action: PortfolioReadAction, snapshot: PortfolioSnapshot) {
    if (action === 'get_portfolio_overdue_work') {
      return snapshot.summary.totalOverdueWork
        ? `${snapshot.summary.totalOverdueWork} elemento(s) vencido(s) están registrados en el portafolio autorizado.`
        : 'No hay trabajo vencido registrado en el portafolio autorizado.';
    }
    if (action === 'get_portfolio_signals') {
      return snapshot.summary.openOperationalSignals
        ? `${snapshot.summary.openOperationalSignals} señal(es) operativa(s) activa(s), sin significado legal ni predicción.`
        : 'No hay señales operativas activas registradas en el portafolio autorizado.';
    }
    if (action === 'get_portfolio_evidence_state') {
      return snapshot.summary.evidencePackagesRequiringWork
        ? `${snapshot.summary.evidencePackagesRequiringWork} paquete(s) de evidencia permanecen en borrador.`
        : 'No hay paquetes de evidencia en borrador registrados en el portafolio autorizado.';
    }
    if (action === 'get_organization_summary') {
      const organization = snapshot.organizations[0];
      return organization
        ? `${organization.organization.name}: ${organization.language.toLowerCase()}, con ${organization.overdueActionableWorkCount} elemento(s) vencido(s), ${organization.activeSignalCount} señal(es) y ${organization.evidencePackages.draft} paquete(s) en borrador.`
        : 'La organización ya no está disponible en tu acceso activo.';
    }
    return snapshot.summary.organizationsRequiringAttention
      ? `${snapshot.summary.organizationsRequiringAttention} de ${snapshot.summary.visibleOrganizations} organización(es) necesitan atención por hechos operativos registrados.`
      : 'Ninguna organización visible tiene pendientes críticos registrados.';
  }

  private capability(action: PortfolioReadAction) {
    if (action === 'get_portfolio_summary' || action === 'get_portfolio_attention') {
      return 'COMPARE_FACTUAL_STATE';
    }
    if (action === 'search_portfolio') return 'SEARCH';
    if (action === 'get_organization_summary') return 'EXPLAIN';
    return 'SUMMARIZE';
  }

  private boundary(status: Exclude<PortfolioContextResult, 'ANSWERED'>, summary: string) {
    return {
      ...this.base(status),
      capability: 'SUGGEST_NEXT_QUESTION',
      actionKey: null,
      summary,
      data: null,
      citations: [],
      organizationAnchor: null,
      materialWriteExecuted: false,
    };
  }

  private base(status: PortfolioContextResult) {
    return {
      context: PORTFOLIO_CONTEXT_TYPE,
      provider: this.provider.descriptor.providerKey,
      providerMode: this.provider.descriptor.mode,
      externalProcessing: this.provider.descriptor.externalProcessing,
      status,
      citationValidation: 'AUTHORIZED_ORGANIZATION_SET',
      multiOrganizationMaterialWriteAllowed: false,
    };
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private includesAny(value: string, terms: readonly string[]) {
    return terms.some((term) => value.includes(term));
  }

  private findOrganization<T extends { name: string }>(normalized: string, organizations: T[]) {
    return organizations.find(({ name }) => normalized.includes(this.normalize(name)));
  }
}
