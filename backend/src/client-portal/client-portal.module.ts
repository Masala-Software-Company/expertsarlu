import { Module, forwardRef } from '@nestjs/common';
import { ClientPortalController } from './client-portal.controller';
import { ClientPortalService } from './client-portal.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { DossiersModule } from '../dossiers/dossiers.module';

@Module({
  imports: [NotificationsModule, forwardRef(() => DossiersModule)],
  controllers: [ClientPortalController],
  providers: [ClientPortalService],
})
export class ClientPortalModule {}
