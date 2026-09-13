import { Module } from '@nestjs/common';
import { PartenairesController } from './partenaires.controller';
import { PartenairesService } from './partenaires.service';

@Module({
  controllers: [PartenairesController],
  providers: [PartenairesService],
  exports: [PartenairesService],
})
export class PartenairesModule {}
