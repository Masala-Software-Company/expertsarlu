import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { TarificationService } from './tarification.service';
import { RequireRole } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

class UpdateTarifDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  montant!: number;
}

class CreateTarifDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  libelle!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  cle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  montant!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unite?: string;
}

@ApiTags('tarification')
@ApiBearerAuth()
@Controller('tarification')
@RequireRole('SUPER_ADMIN')
export class TarificationController {
  constructor(private tarifs: TarificationService) {}

  @Get()
  list() {
    return this.tarifs.list();
  }

  @Post()
  create(@Body() dto: CreateTarifDto, @CurrentUser() user: AuthUser) {
    return this.tarifs.create(dto, user);
  }

  @Patch(':cle')
  update(
    @Param('cle') cle: string,
    @Body() dto: UpdateTarifDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tarifs.update(cle, dto.montant, user);
  }
}
