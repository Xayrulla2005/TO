import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/http.exception.filter';
import { TraceIdInterceptor } from './common/interceptors/trace.id.interceptor';
import helmet from 'helmet';
import * as express from 'express';
import { config } from 'dotenv';
import * as path from 'path';
import cookieParser from 'cookie-parser';

config();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'debug', 'error', 'warn', 'verbose'],
  });

  const port = parseInt(process.env.PORT || '3000', 10);

  // ── CORS: faqat 1 marta, to'liq konfiguratsiya ──────────────
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((x) => x.trim());

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-trace-id'],
    credentials: true,
    maxAge: 86400,
  });

  // ── Security Headers ─────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // upload rasmlar uchun
    }),
  );

  // ── Cookie Parser ────────────────────────────────────────────
  app.use(cookieParser());

  // ── Static File Serving ──────────────────────────────────────
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  app.use('/uploads', express.static(path.resolve(uploadDir)));

  // ── Global Validation Pipe ───────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const messages = errors.map((e) =>
          Object.values(e.constraints || {}).join(', '),
        );
        return new BadRequestException(messages);
      },
    }),
  );

  // ── Global Exception Filter ──────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Global Interceptors ──────────────────────────────────────
  app.useGlobalInterceptors(new TraceIdInterceptor());

  // ── Swagger (faqat development) ──────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const apiVersion = process.env.API_VERSION || 'v1';
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP System API')
      .setDescription('Enterprise Resource Planning System API')
      .setVersion(apiVersion)
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addCookieAuth('refresh_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`api/${apiVersion}/docs`, app, document);
    app
      .getHttpAdapter()
      .get(`/api/${apiVersion}/openapi.json`, (_req, res) => res.json(document));
  }

  // ── Health Check ─────────────────────────────────────────────
  app.getHttpAdapter().get('/health', async (_req, res) => {
    const health: Record<string, any> = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memory: {
        usedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        totalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      services: {},
    };

    try {
      const dataSource = app.get('DataSource');
      await dataSource.query('SELECT 1');
      health.services.database = 'ok';
    } catch {
      health.services.database = 'error';
      health.status = 'degraded';
    }

    try {
      const redisService = app.get('RedisService', { strict: false });
      if (redisService) {
        await redisService.get('health-check');
        health.services.redis = 'ok';
      }
    } catch {
      health.services.redis = 'error';
    }

    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });

  // ── Graceful Shutdown ────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ── Start ────────────────────────────────────────────────────
  await app.listen(port);
  console.log(`✅ ERP Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`📖 Swagger: http://localhost:${port}/api/v1/docs`);
  }
}

bootstrap().catch(console.error);