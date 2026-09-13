import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DossiersModule } from './dossiers/dossiers.module';
import { CotationModule } from './cotation/cotation.module';
import { TarificationModule } from './tarification/tarification.module';
import { FacturationModule } from './facturation/facturation.module';
import { LogistiqueModule } from './logistique/logistique.module';
import { GedModule } from './ged/ged.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { VersionModule } from './version/version.module';
import { ProspectsModule } from './prospects/prospects.module';
import { PatientsModule } from './patients/patients.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { AuditInterceptor } from './audit/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    DossiersModule,
    CotationModule,
    TarificationModule,
    FacturationModule,
    LogistiqueModule,
    GedModule,
    AuditModule,
    NotificationsModule,
    HealthModule,
    VersionModule,
    ProspectsModule,
    PatientsModule,
    ClientPortalModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
