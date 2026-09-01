import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AdaptiveConfigurationModule } from './adaptive-configuration/adaptive-configuration.module';
import { ApplicabilityModule } from './applicability/applicability.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { EntitlementsModule } from './catalog/entitlements.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { InspectionsModule } from './inspections/inspections.module';
import { IncidentsModule } from './incidents/incidents.module';
import { PpeModule } from './ppe/ppe.module';
import { InspectionStandardsModule } from './inspection-standards/inspection-standards.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OperationalExecutionModule } from './operational-execution/operational-execution.module';
import { PrismaModule } from './prisma/prisma.module';
import { RegulatorySourceModule } from './regulatory-sources/regulatory-source.module';
import { RegulatoryRiskLinkModule } from './regulatory-risk-links/regulatory-risk-link.module';
import { RiskMethodologyModule } from './risk-methodology/risk-methodology.module';
import { SolutionFinderModule } from './solution-finder/solution-finder.module';
import { TechnicalRiskModule } from './technical-risk/technical-risk.module';
import { TrainingModule } from './training/training.module';
import { UnifiedSstEvaluationModule } from './unified-sst-evaluation/unified-sst-evaluation.module';
import { WorkQueueModule } from './work-queue/work-queue.module';
import { WorkPermitsModule } from './work-permits/work-permits.module';
import { WorkersModule } from './workers/workers.module';

const configuredThrottleLimit = Number(process.env.API_THROTTLE_LIMIT ?? '120');

if (!Number.isInteger(configuredThrottleLimit) || configuredThrottleLimit < 1) {
  throw new Error('API_THROTTLE_LIMIT must be a positive integer');
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        if (config.NODE_ENV === 'production') {
          if (config.COOKIE_SECURE !== 'true') {
            throw new Error('COOKIE_SECURE must be true in production');
          }
          if (typeof config.WEB_ORIGIN !== 'string' || config.WEB_ORIGIN.length === 0) {
            throw new Error('WEB_ORIGIN must be configured in production');
          }
        }
        return config;
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: configuredThrottleLimit }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    EntitlementsModule,
    OrganizationsModule,
    OperationalExecutionModule,
    CatalogModule,
    AiModule,
    AdaptiveConfigurationModule,
    ApplicabilityModule,
    RegulatorySourceModule,
    RegulatoryRiskLinkModule,
    RiskMethodologyModule,
    SolutionFinderModule,
    DashboardModule,
    InspectionStandardsModule,
    InspectionsModule,
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
