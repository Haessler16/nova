import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ALL_PERMISSIONS } from '../../access/permissions';

export class PropertyAssignmentDto {
  @IsUUID()
  propertyId!: string;

  @IsUUID()
  roleId!: string;
}

export class CreateMembershipDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PropertyAssignmentDto)
  propertyAssignments?: PropertyAssignmentDto[];
}

export class UpdateMembershipDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'DISABLED'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  removeRole?: boolean;
}

export class CreatePropertyMembershipDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  roleId!: string;
}

export class UpdatePropertyMembershipDto {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'DISABLED'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
}

export class CreateRoleDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_.-]{2,64}$/, {
    message: 'key must contain 2-64 letters, digits, dots, hyphens or underscores',
  })
  key!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsArray()
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @ArrayUnique()
  @IsIn([...ALL_PERMISSIONS], { each: true })
  permissions!: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ALL_PERMISSIONS.length)
  @ArrayUnique()
  @IsIn([...ALL_PERMISSIONS], { each: true })
  permissions?: string[];
}
