import { PrismaClient } from '@prisma/client';
import { syncGlobalReferenceData } from './risk-methodology-reference-sync';

const prisma = new PrismaClient();

syncGlobalReferenceData(prisma)
  .then((counts) => {
    console.log(JSON.stringify({ status: 'ok', riskMethodology: counts }));
  })
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
