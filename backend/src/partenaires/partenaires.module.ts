import { Module } from '@nestjs/common';
import { PartenairesController } from './partenaires.controller';
import { PartenairesService } from './partenaires.service';
import { PartenairesMigrationService } from './partenaires-migration.service';

@Module({
  controllers: [PartenairesController],
  providers: [PartenairesService, PartenairesMigrationService],
  exports: [PartenairesService],
})
export class PartenairesModule {}
