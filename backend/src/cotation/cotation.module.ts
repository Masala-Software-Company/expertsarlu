import { Module } from '@nestjs/common';
import { CotationService } from './cotation.service';
import { CotationController } from './cotation.controller';

@Module({
  controllers: [CotationController],
  providers: [CotationService],
  exports: [CotationService],
})
export class CotationModule {}
