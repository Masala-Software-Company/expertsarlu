import { Module, forwardRef } from '@nestjs/common';
import { PreInscriptionsController } from './pre-inscriptions.controller';
import { PreInscriptionsService } from './pre-inscriptions.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { DossiersModule } from '../dossiers/dossiers.module';

@Module({
  imports: [
    AuditModule,
    NotificationsModule,
    StorageModule,
    forwardRef(() => DossiersModule),
  ],
  controllers: [PreInscriptionsController],
  providers: [PreInscriptionsService],
  exports: [PreInscriptionsService],
})
export class PreInscriptionsModule {}
