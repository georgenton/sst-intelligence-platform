import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EntitlementsModule } from '../catalog/entitlements.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OccupationalHealthController } from './occupational-health.controller';
import { PsychosocialController } from './psychosocial.controller';
import { OrganizationalHealthService } from './organizational-health.service';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, OrganizationsModule, EntitlementsModule],
  controllers: [OccupationalHealthController, PsychosocialController],
  providers: [OrganizationalHealthService],
})
export class OrganizationalHealthModule {}
