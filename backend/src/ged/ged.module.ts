import { Module } from '@nestjs/common';
import { GedService } from './ged.service';
import { GedController } from './ged.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [GedController],
  providers: [GedService],
})
export class GedModule {}
