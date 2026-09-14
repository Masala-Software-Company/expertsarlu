import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { PartenairesService } from './partenaires.service';
import { RequirePermission } from '../auth/decorators';

class PartenaireDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  nom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pays?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('partenaires')
@ApiBearerAuth()
@Controller('partenaires')
export class PartenairesController {
  constructor(private partenaires: PartenairesService) {}

  @Get()
  @RequirePermission({ module: 'partenaires', action: 'read' })
  list(@Query('all') all?: string) {
    return this.partenaires.list(all === '1' || all === 'true');
  }

  @Get(':id/patients')
  @RequirePermission({ module: 'partenaires', action: 'read' })
  patients(@Param('id') id: string) {
    return this.partenaires.patients(id);
  }

  @Post()
  @RequirePermission({ module: 'partenaires', action: 'create' })
  create(@Body() dto: PartenaireDto) {
    return this.partenaires.create(dto);
  }

  @Patch(':id')
  @RequirePermission({ module: 'partenaires', action: 'update' })
  update(@Param('id') id: string, @Body() dto: PartenaireDto & { actif?: boolean }) {
    return this.partenaires.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission({ module: 'partenaires', action: 'update' })
  remove(@Param('id') id: string) {
    return this.partenaires.remove(id);
  }
}
