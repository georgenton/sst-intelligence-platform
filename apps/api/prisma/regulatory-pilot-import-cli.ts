import { PrismaClient } from '@prisma/client';
import {
  assertRegulatoryEditorialImportAllowed,
  importRegulatoryPilotCandidates,
  loadRegulatoryPilotImportManifest,
} from './regulatory-pilot-import';

async function main() {
  assertRegulatoryEditorialImportAllowed(process.env, process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const report = await prisma.$transaction((transaction) =>
      importRegulatoryPilotCandidates(transaction, loadRegulatoryPilotImportManifest()),
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
