import { Module } from '@nestjs/common';
import { TarificationService } from './tarification.service';
import { TarificationController } from './tarification.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TarificationController],
  providers: [TarificationService],
  exports: [TarificationService],
})
export class TarificationModule {}
