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
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { DossiersService } from './dossiers.service';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { RequirePermission, RequireRole } from '../auth/decorators';

class MotifDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  motif!: string;
}

class HardDeleteDto {
  @ApiProperty({ description: 'Numéro MED-YYYY-XXXX exact pour confirmer' })
  @IsString()
  confirmationNumero!: string;
}

@ApiTags('dossiers')
@ApiBearerAuth()
@Controller('dossiers')
export class DossiersController {
  constructor(private dossiers: DossiersService) {}

  @Post()
  @RequirePermission({ module: 'dossiers', action: 'create' })
  create(@Body() dto: CreateDossierDto, @CurrentUser() user: AuthUser) {
    return this.dossiers.create(dto, user);
  }

  @Get()
  @RequirePermission({ module: 'dossiers', action: 'read' })
  findAll(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.dossiers.findAll(user, q);
  }

  @Get('corbeille')
  @RequireRole('SUPER_ADMIN', 'ASSISTANT_MANAGER')
  corbeille(@CurrentUser() user: AuthUser) {
    return this.dossiers.corbeille(user);
  }

  /** Routes statiques AVANT :id pour éviter les collisions Nest */
  @Get('demandes-deverrouillage')
  @RequireRole('SUPER_ADMIN', 'ASSISTANT_MANAGER')
  listUnlock(@CurrentUser() user: AuthUser) {
    return this.dossiers.listDemandesUnlock(user);
  }

  @Patch('demandes-deverrouillage/:demandeId/approuver')
  @RequireRole('SUPER_ADMIN')
  approuver(
    @Param('demandeId') demandeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dossiers.approuverDeverrouillage(demandeId, user);
  }

  @Patch('demandes-deverrouillage/:demandeId/refuser')
  @RequireRole('SUPER_ADMIN')
  refuser(
    @Param('demandeId') demandeId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dossiers.refuserDeverrouillage(demandeId, user);
  }

  @Get(':id')
  @RequirePermission({ module: 'dossiers', action: 'read' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dossiers.findOne(id, user);
  }

  @Patch(':id')
  @RequirePermission({ module: 'dossiers', action: 'update' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDossierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dossiers.update(id, dto, user);
  }

  @Post(':id/valider')
  @RequirePermission({ module: 'dossiers', action: 'validate' })
  validate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dossiers.validate(id, user);
  }

  @Delete(':id')
  @RequirePermission({ module: 'dossiers', action: 'delete' })
  softDelete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dossiers.softDelete(id, user);
  }

  @Patch(':id/restaurer')
  @RequireRole('SUPER_ADMIN')
  restore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dossiers.restore(id, user);
  }

  @Delete(':id/definitif')
  @RequireRole('SUPER_ADMIN')
  hardDelete(
    @Param('id') id: string,
    @Body() dto: HardDeleteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dossiers.hardDelete(id, dto.confirmationNumero, user);
  }

  @Patch(':id/statut')
  @RequirePermission({ module: 'dossiers', action: 'update' })
  changerStatut(
    @Param('id') id: string,
    @Body() dto: { statut: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.dossiers.changerStatut(id, dto.statut as never, user);
  }

  @Post(':id/suivi-token')
  @RequirePermission({ module: 'dossiers', action: 'read' })
  suiviToken(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dossiers.ensureSuiviToken(id, user);
  }

  @Patch(':id/post-retour')
  @RequirePermission({ module: 'dossiers', action: 'update' })
  postRetour(
    @Param('id') id: string,
    @Body() dto: { postRetourStatut: string; postRetourNotes?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.dossiers.updatePostRetour(id, dto, user);
  }

  @Post(':id/demande-deverrouillage')
  @RequirePermission({ module: 'dossiers', action: 'update' })
  demandeUnlock(
    @Param('id') id: string,
    @Body() dto: MotifDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dossiers.demandeDeverrouillage(id, dto.motif, user);
  }

  @Post(':id/deverrouiller')
  @RequireRole('SUPER_ADMIN')
  unlockDirect(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.dossiers.deverrouillerDirect(id, user);
  }
}
