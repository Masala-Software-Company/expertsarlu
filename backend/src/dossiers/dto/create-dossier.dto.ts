import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priorite, TypeClient } from '@prisma/client';

class PatientDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  nom!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  prenom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateNaissance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationalite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adresse?: string;
}

class AccompagnateurDto {
  @ApiProperty()
  @IsString()
  nom!: string;

  @ApiProperty()
  @IsString()
  prenom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lien?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telephone?: string;
}

export class CreateDossierDto {
  @ApiProperty({ enum: TypeClient })
  @IsEnum(TypeClient)
  typeClient!: TypeClient;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pathologie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  budget?: number;

  @ApiPropertyOptional({ enum: Priorite })
  @IsOptional()
  @IsEnum(Priorite)
  priorite?: Priorite;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: PatientDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PatientDto)
  patient?: PatientDto;

  @ApiPropertyOptional({ type: [AccompagnateurDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccompagnateurDto)
  accompagnateurs?: AccompagnateurDto[];
}
