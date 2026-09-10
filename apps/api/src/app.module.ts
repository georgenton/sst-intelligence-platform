import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AdaptiveConfigurationModule } from './adaptive-configuration/adaptive-configuration.module';
import { AdaptiveIntelligenceModule } from './adaptive-intelligence/adaptive-intelligence.module';
import { ApplicabilityModule } from './applicability/applicability.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { ConsultantPortfolioModule } from './consultant-portfolio/consultant-portfolio.module';
import { ConversationalOperationsModule } from './conversational-operations/conversational-operations.module';
import { EntitlementsModule } from './catalog/entitlements.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { GovernanceModule } from './governance/governance.module';
import { EvidencePackagesModule } from './evidence-packages/evidence-packages.module';
import { InspectionsModule } from './inspections/inspections.module';
import { ManagementIntelligenceModule } from './management-intelligence/management-intelligence.module';
import { IncidentsModule } from './incidents/incidents.module';
import { PpeModule } from './ppe/ppe.module';
import { InspectionStandardsModule } from './inspection-standards/inspection-standards.module';
import { InspectionResourcesModule } from './inspection-resources/inspection-resources.module';
import { InspectionBasisModule } from './inspection-basis/inspection-basis.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OperationalExecutionModule } from './operational-execution/operational-execution.module';
import { OperationalIntelligenceModule } from './operational-intelligence/operational-intelligence.module';
import { OperationalPlansModule } from './operational-plans/operational-plans.module';
import { OperationalSearchModule } from './operational-search/operational-search.module';
import { PrismaModule } from './prisma/prisma.module';
import { RegulatorySourceModule } from './regulatory-sources/regulatory-source.module';
import { RegulatoryRiskLinkModule } from './regulatory-risk-links/regulatory-risk-link.module';
import { RiskMethodologyModule } from './risk-methodology/risk-methodology.module';
import { SafetyObservationsModule } from './safety-observations/safety-observations.module';
import { SolutionFinderModule } from './solution-finder/solution-finder.module';
import { SstAssessmentModule } from './sst-assessment/sst-assessment.module';
import { TechnicalRiskModule } from './technical-risk/technical-risk.module';
import { TrainingModule } from './training/training.module';
import { UnifiedSstEvaluationModule } from './unified-sst-evaluation/unified-sst-evaluation.module';
import { WorkQueueModule } from './work-queue/work-queue.module';
import { WorkPermitsModule } from './work-permits/work-permits.module';
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const explicitDeployment =
          typeof config.SST_DEPLOYMENT_ENVIRONMENT === 'string'
            ? config.SST_DEPLOYMENT_ENVIRONMENT.toLowerCase()
            : null;
        const platformProduction =
          (typeof config.RAILWAY_ENVIRONMENT_NAME === 'string' &&
            config.RAILWAY_ENVIRONMENT_NAME.toLowerCase() === 'production') ||
          (typeof config.VERCEL_ENV === 'string' &&
            config.VERCEL_ENV.toLowerCase() === 'production');
        const deploymentEnvironment = platformProduction
          ? 'production'
          : (explicitDeployment ?? (config.NODE_ENV === 'production' ? 'production' : 'local'));
        if (config.NODE_ENV === 'production') {
          if (config.COOKIE_SECURE !== 'true') {
            throw new Error('COOKIE_SECURE must be true in production');
          }
          if (typeof config.WEB_ORIGIN !== 'string' || config.WEB_ORIGIN.length === 0) {
            throw new Error('WEB_ORIGIN must be configured in production');
          }
        }
        if (
          deploymentEnvironment === 'production' &&
          (config.CONVERSATIONAL_AI_EXTERNAL_ENABLED === 'true' ||
            config.CONVERSATIONAL_AI_PROVIDER === 'OPENAI' ||
            config.AI_ENABLED === 'true')
        ) {
          throw new Error('External AI must remain disabled in production');
        }
        if (config.CONVERSATIONAL_AI_EXTERNAL_ENABLED === 'true') {
          if (deploymentEnvironment !== 'staging') {
            throw new Error('Conversational external AI is allowed only in staging');
          }
          if (config.CONVERSATIONAL_AI_PROVIDER !== 'OPENAI') {
            throw new Error('CONVERSATIONAL_AI_PROVIDER must be OPENAI when enabled');
          }
          if (config.CONVERSATIONAL_AI_OPENAI_MODEL !== 'gpt-5.6-terra') {
            throw new Error('The controlled staging model must be gpt-5.6-terra');
          }
          for (const key of [
            'OPENAI_API_KEY',
            'CONVERSATIONAL_AI_STAGING_ORGANIZATION_IDS',
            'CONVERSATIONAL_AI_STAGING_USER_IDS',
          ]) {
            if (typeof config[key] !== 'string' || config[key].trim().length === 0) {
              throw new Error(`${key} must be configured for controlled staging`);
            }
          }
        }
        return config;
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    EntitlementsModule,
    OrganizationsModule,
    OperationalExecutionModule,
    OperationalIntelligenceModule,
    OperationalPlansModule,
    OperationalSearchModule,
    CatalogModule,
    ConsultantPortfolioModule,
    ConversationalOperationsModule,
    AiModule,
    AdaptiveConfigurationModule,
    AdaptiveIntelligenceModule,
    ApplicabilityModule,
    RegulatorySourceModule,
    RegulatoryRiskLinkModule,
    RiskMethodologyModule,
    SafetyObservationsModule,
    SolutionFinderModule,
    SstAssessmentModule,
    DashboardModule,
    GovernanceModule,
    EvidencePackagesModule,
    InspectionStandardsModule,
    InspectionResourcesModule,
    InspectionBasisModule,
    InspectionsModule,
    ManagementIntelligenceModule,
    IncidentsModule,
    PpeModule,
    TechnicalRiskModule,
    TrainingModule,
    UnifiedSstEvaluationModule,
    WorkQueueModule,
    WorkPermitsModule,
    WorkersModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
