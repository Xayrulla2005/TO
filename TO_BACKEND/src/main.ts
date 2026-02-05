import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { GlobalExceptionFilter } from "./common/filters/http.exception.filter";
import { TraceIdInterceptor } from "./common/interceptors/trace.id.interceptor";
import { SuccessResponseInterceptor } from "./common/interceptors/success.response.interceptor";
import helmet from "helmet";
import { ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import * as express from "express";
import { config } from "dotenv";
import * as path from "path";
import { DataSource } from "typeorm";

config();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["log", "debug", "error", "warn", "verbose"],
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:8080";

  // ── Security Headers (Helmet) ───────────────────────────
  app.use(helmet());

  // ── CORS ────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigin,
    methods: (process.env.CORS_METHODS || "GET,POST,PUT,PATCH,DELETE").split(
      ",",
    ),
    allowedHeaders: (
      process.env.CORS_ALLOWED_HEADERS || "Content-Type,Authorization"
    ).split(","),
    credentials: true, // Required for httpOnly cookies
    maxAge: 86400, // 24 hours
  });

  // ── Cookie Parser ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cookieParser = require("cookie-parser");
  app.use(cookieParser());

  // ── Static File Serving for uploads ─────────────────────
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  app.use("/uploads", express.static(path.resolve(uploadDir)));

  // ── Global Validation Pipe ──────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Reject unknown properties
      transform: true, // Enable class-transformer
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global Exception Filter ─────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Global Interceptors ─────────────────────────────────
  app.useGlobalInterceptors(new TraceIdInterceptor());
  // Note: SuccessResponseInterceptor wraps responses - enable if desired
  // app.useGlobalInterceptors(new SuccessResponseInterceptor());

  // ── Swagger / OpenAPI ───────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const apiVersion = process.env.API_VERSION || "v1";

  const swaggerConfig = new DocumentBuilder()
    .setTitle("ERP System API")
    .setDescription("Enterprise Resource Planning System API")
    .setVersion(apiVersion)
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "access-token",
    )
    .addCookieAuth("refresh_token")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup(`api/${apiVersion}/docs`, app, document);

  // Optional: raw OpenAPI JSON
  app
    .getHttpAdapter()
    .get(`/api/${apiVersion}/openapi.json`, (_req, res) => {
      res.json(document);
    });
}


  // ── Health Check with DB and Redis connectivity ─────────
  app.getHttpAdapter().get("/health", async (_req, res) => {
    const health: any = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      services: {},
    };

    try {
      // Check database
      const dataSource = app.get("DataSource");
      await dataSource.query("SELECT 1");
      health.services.database = "ok";
    } catch (e) {
      health.services.database = "error";
      health.status = "degraded";
    }

    try {
      // Check Redis
      const redisService = app.get("RedisService");
      await redisService.get("health-check");
      health.services.redis = "ok";
    } catch (e) {
      health.services.redis = "error";
      health.status = "degraded";
    }

    const statusCode = health.status === "ok" ? 200 : 503;
    res.status(statusCode).json(health);
  });

  // ── Metrics (basic) ─────────────────────────────────────
  let requestCount = 0;
  app.use((_req, _res, next) => {
    requestCount++;
    next();
  });

  app.getHttpAdapter().get("/metrics", (_req, res) => {
    res.json({
      requests_total: requestCount,
      uptime_seconds: process.uptime(),
      nodejs_version: process.version,
      process_pid: process.pid,
      memory_heap_used_bytes: process.memoryUsage().heapUsed,
      memory_heap_total_bytes: process.memoryUsage().heapTotal,
      memory_rss_bytes: process.memoryUsage().rss,
    });
  });

  // ── Graceful Shutdown ───────────────────────────────────
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    await app.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("SIGINT received. Shutting down gracefully...");
    await app.close();
    process.exit(0);
  });

  // ── Start Server ────────────────────────────────────────
  await app.listen(port);
  console.log(`ERP Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  if (process.env.NODE_ENV !== "production") {
    console.log(`Swagger docs: http://localhost:${port}/api/v1/docs`);
  }
}

bootstrap().catch(console.error);
