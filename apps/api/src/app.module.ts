import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { ApplicabilityModule } from './applicability/applicability.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { EntitlementsModule } from './catalog/entitlements.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { InspectionsModule } from './inspections/inspections.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { RegulatorySourceModule } from './regulatory-sources/regulatory-source.module';
import { SolutionFinderModule } from './solution-finder/solution-finder.module';
import { TechnicalRiskModule } from './technical-risk/technical-risk.module';

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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    EntitlementsModule,
    OrganizationsModule,
    CatalogModule,
    AiModule,
    ApplicabilityModule,
    RegulatorySourceModule,
    SolutionFinderModule,
    DashboardModule,
    InspectionsModule,
    TechnicalRiskModule,
  ],
  controllers: [HealthController],
  providers: [HealthService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
