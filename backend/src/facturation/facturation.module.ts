import { Module } from '@nestjs/common';
import { FacturationService } from './facturation.service';
import { FacturationController } from './facturation.controller';
import { CotationModule } from '../cotation/cotation.module';

@Module({
  imports: [CotationModule],
  controllers: [FacturationController],
  providers: [FacturationService],
})
export class FacturationModule {}
