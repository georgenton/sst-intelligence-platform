import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AdaptivePublicationService } from '../src/adaptive-configuration/adaptive-publication.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  importRegulatoryPilotCandidates,
  loadRegulatoryPilotImportManifest,
} from '../prisma/regulatory-pilot-import';

class ExpectedEditorialRollback extends Error {}

describe('controlled real regulatory pilot editorial import', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let publication: AdaptivePublicationService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    publication = app.get(AdaptivePublicationService);
  });

  afterAll(async () => app.close());

  it('imports pending candidates only in a rollback-isolated transaction and blocks publication', async () => {
    const manifest = loadRegulatoryPilotImportManifest();
    await expect(
      prisma.$transaction(async (transaction) => {
        const report = await importRegulatoryPilotCandidates(transaction, manifest);
        expect(report).toEqual({
          provisions: 2,
          requirements: 5,
          ruleDrafts: 5,
          technicalReview: 'PENDING',
          legalReview: 'PENDING',
          publishedRuleVersions: 0,
          publishedPackVersions: 0,
        });
        expect(
          await transaction.regulatoryProvision.count({
            where: { provisionKey: { startsWith: 'MDT_2024_196_ART_' } },
          }),
        ).toBe(2);
        expect(
          await transaction.regulatoryRequirement.count({
            where: { requirementKey: { startsWith: 'MDT_2024_196_' } },
          }),
        ).toBe(5);
        expect(
          await transaction.regulatoryRequirementSource.count({
            where: { requirement: { requirementKey: { startsWith: 'MDT_2024_196_' } } },
          }),
        ).toBe(6);
        expect(
          await transaction.adaptiveRuleDraft.count({
            where: { regulatory: true, isDemo: false, status: 'TECHNICAL_REVIEW_PENDING' },
          }),
        ).toBe(5);
        expect(await transaction.adaptiveRuleVersion.count({ where: { regulatory: true } })).toBe(
          0,
        );
        expect(
          await transaction.adaptiveRulePackVersion.count({ where: { regulatory: true } }),
        ).toBe(0);

        const draft = await transaction.adaptiveRuleDraft.findUniqueOrThrow({
          where: { id: manifest.ruleDrafts[0]!.draftId },
        });
        const requirement = await transaction.regulatoryRequirement.findUniqueOrThrow({
          where: { requirementKey: manifest.ruleDrafts[0]!.requirementKeys[0]! },
        });
        await transaction.adaptiveRuleDraft.update({
          where: { id: draft.id },
          data: { status: 'READY_TO_PUBLISH' },
        });
        await expect(
          publication.publishRuleDraft(
            {
              draftId: draft.id,
              version: manifest.ruleDrafts[0]!.rule.version,
              requirementLinks: [
                {
                  requirementId: requirement.id,
                  relationshipType: 'PRIMARY_REQUIREMENT',
                },
              ],
            },
            transaction,
          ),
        ).rejects.toThrow('Regulatory rule requires approved requirements');
        expect(await transaction.adaptiveRuleVersion.count({ where: { regulatory: true } })).toBe(
          0,
        );
        throw new ExpectedEditorialRollback();
      }),
    ).rejects.toBeInstanceOf(ExpectedEditorialRollback);

    expect(
      await prisma.regulatoryProvision.count({
        where: { provisionKey: { startsWith: 'MDT_2024_196_ART_' } },
      }),
    ).toBe(0);
    expect(
      await prisma.regulatoryRequirement.count({
        where: { requirementKey: { startsWith: 'MDT_2024_196_' } },
      }),
    ).toBe(0);
    expect(
      await prisma.adaptiveRuleDraft.count({ where: { regulatory: true, isDemo: false } }),
    ).toBe(0);
  });
});
