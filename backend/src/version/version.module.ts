import { Module } from '@nestjs/common';
import { VersionController } from './version.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [VersionController],
})
export class VersionModule {}
