import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.use((request: Request & { id?: string }, response: Response, next: NextFunction) => {
    const startedAt = performance.now();
    request.id =
      typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : randomUUID();
    response.setHeader('x-request-id', request.id);
    response.on('finish', () => {
      process.stdout.write(
        `${JSON.stringify({
          level: 'info',
          event: 'http_request',
          requestId: request.id,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        })}\n`,
      );
    });
    next();
  });
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swagger = new DocumentBuilder()
    .setTitle(process.env.APP_NAME ?? 'SST Inteligente')
    .setDescription('API REST multiempresa para el primer incremento funcional de SST.')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-organization-id' }, 'organization')
    .build();
  SwaggerModule.setup('api/v1/docs', app, SwaggerModule.createDocument(app, swagger));

  const prisma = app.get(PrismaService);
  prisma.enableShutdownHooks(app);
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}

void bootstrap();
