import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import {
  resolveDeploymentEnvironment,
  resolveSafeReleaseSha,
} from './common/deployment-environment';
import { readOpenAiStagingConfiguration } from './conversational-operations/openai-staging-policy';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    const external = readOpenAiStagingConfiguration();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: resolveDeploymentEnvironment(),
      gitSha: resolveSafeReleaseSha(),
      provider:
        external.deploymentEnvironment === 'staging' &&
        external.provider === 'OPENAI' &&
        external.globallyEnabled
          ? 'OPENAI'
          : 'DETERMINISTIC_LOCAL_V1',
    };
  }
}
