import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';

function loadWorkspaceEnv() {
  const envPath = resolve(process.cwd(), '..', '..', '.env');
  const forceOverrideKeys = new Set(['DATABASE_URL', 'DATABASE_SHADOW_URL', 'REDIS_URL', 'JWT_SECRET']);

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, 'utf8');

  for (const rawLine of envFile.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (forceOverrideKeys.has(key) || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadWorkspaceEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('API_PORT', 3001);
  await app.listen(port);

  console.log(`API Server running on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start API server:', error);
  process.exit(1);
});
