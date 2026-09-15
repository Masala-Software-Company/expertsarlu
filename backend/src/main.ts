import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const defaultOrigins = [
    'http://localhost:1420',
    'http://localhost:5174',
    'http://localhost:5173',
    'https://patient.expert-evac.com',
    'https://form.expert-evac.com',
    'https://verify.expert-evac.com',
    'https://patient-form-gold.vercel.app',
  ];
  const envOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Env complète les origines par défaut (ne les remplace pas)
  const origins = [...new Set([...defaultOrigins, ...envOrigins])];

  // Tauri (macOS/Windows) peut envoyer tauri://localhost, https://tauri.localhost ou Origin: null
  const tauriOrigins = [
    'tauri://localhost',
    'https://tauri.localhost',
    'http://tauri.localhost',
  ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || origins.includes(origin) || tauriOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/(.*)', method: RequestMethod.ALL },
      { path: 'v', method: RequestMethod.ALL },
      { path: 'v/(.*)', method: RequestMethod.ALL },
    ],
  });

  const swagger = new DocumentBuilder()
    .setTitle('eXpert SARLU API')
    .setDescription('API centrale — Bureau de Coordination Médicale Internationale')
    .setVersion(process.env.APP_VERSION ?? '1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`eXpert API listening on :${port} — docs at /api/docs`);
}

bootstrap();
