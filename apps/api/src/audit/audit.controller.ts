import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { RequireRole } from '../auth/decorators';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @RequireRole('SUPER_ADMIN', 'ASSISTANT_MANAGER')
  list(
    @Query('table') tableCible?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.findAll({
      tableCible,
      userId,
      limit: limit ? Number(limit) : 100,
    });
  }
}
