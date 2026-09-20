import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { IncidentsService } from '../src/incidents/incidents.service';
import { PpeService } from '../src/ppe/ppe.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkersService } from '../src/workers/workers.service';
import { ppeContinuityFixture } from './support/ppe-continuity-fixture';

describe('EPP server search and pagination', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ppe: PpeService;
  let workers: WorkersService;
  let incidents: IncidentsService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);
    ppe = app.get(PpeService);
    workers = app.get(WorkersService);
    incidents = app.get(IncidentsService);
  });

  afterAll(async () => app.close());

  it('finds catalog, worker and incident #101+ through server-side search', async () => {
    const fixture = await ppeContinuityFixture(app);
    await prisma.ppeCatalogItem.createMany({
      data: Array.from({ length: 125 }, (_, index) => ({
        organizationId: fixture.organizationId,
        createdById: fixture.user.id,
        name: `Elemento ${index + 1}`,
        category: 'HEAD' as const,
      })),
    });
    await prisma.worker.createMany({
      data: Array.from({ length: 125 }, (_, index) => ({
        organizationId: fixture.organizationId,
        createdById: fixture.user.id,
        workCenterId: fixture.center.id,
        displayName: `Persona ${index + 1}`,
      })),
    });
    await prisma.incident.createMany({
      data: Array.from({ length: 125 }, (_, index) => ({
        organizationId: fixture.organizationId,
        reportedByUserId: fixture.user.id,
        workCenterId: fixture.center.id,
        occurredAt: new Date(Date.now() - index * 60_000),
        title: `Evento ${index + 1}`,
        description: 'Evento sintético para búsqueda server-side.',
        eventType: 'NEAR_MISS' as const,
        eventLocation: 'OWN_FACILITY' as const,
        attentionPriority: 'MEDIUM' as const,
      })),
    });

    const catalog = await ppe.catalog(fixture.organizationId, {
      page: 1,
      pageSize: 20,
      search: 'Elemento 125',
    });
    expect(catalog.total).toBe(1);
    expect(catalog.items[0]?.name).toBe('Elemento 125');

    const workerPage = await workers.list(fixture.organizationId, {
      page: 1,
      pageSize: 20,
      search: 'Persona 125',
    });
    expect(workerPage.total).toBe(1);
    expect(workerPage.items[0]?.displayName).toBe('Persona 125');

    const incidentPage = await incidents.list(fixture.organizationId, {
      page: 1,
      pageSize: 20,
      search: 'Evento 125',
    });
    expect(incidentPage.total).toBe(1);
    expect(incidentPage.items[0]?.title).toBe('Evento 125');

    const secondPage = await ppe.catalog(fixture.organizationId, { page: 6, pageSize: 20 });
    expect(secondPage.total).toBe(126);
    expect(secondPage.items.length).toBeGreaterThan(0);
  });
});
