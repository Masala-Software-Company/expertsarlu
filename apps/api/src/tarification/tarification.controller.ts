import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';
import { TarificationService } from './tarification.service';
import { RequireRole } from '../auth/decorators';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

class UpdateTarifDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  montant!: number;
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

  @Patch(':cle')
  update(
    @Param('cle') cle: string,
    @Body() dto: UpdateTarifDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tarifs.update(cle, dto.montant, user);
  }
}
