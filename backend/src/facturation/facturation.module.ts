import { Module } from '@nestjs/common';
import { FacturationService } from './facturation.service';
import { FacturationController } from './facturation.controller';
import { PublicVerifyController } from './public-verify.controller';
import { CotationModule } from '../cotation/cotation.module';
import { PdfModule } from '../pdf/pdf.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CotationModule, PdfModule, StorageModule, NotificationsModule],
  controllers: [FacturationController, PublicVerifyController],
  providers: [FacturationService],
  exports: [FacturationService],
})
export class FacturationModule {}
