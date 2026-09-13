import { Module } from '@nestjs/common';
import { LogistiqueService } from './logistique.service';
import { LogistiqueController } from './logistique.controller';

@Module({
  controllers: [LogistiqueController],
  providers: [LogistiqueService],
})
export class LogistiqueModule {}
