import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(1, 128)
  password!: string;

  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'mfaCode must contain exactly 6 digits' })
  mfaCode?: string;
}

export class MfaLoginDto {
  @IsString()
  @Length(20, 2048)
  challengeToken!: string;

  @Matches(/^\d{6}$/, { message: 'code must contain exactly 6 digits' })
  code!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @IsString()
  @Length(1, 128)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(20, 256)
  token!: string;

  @IsString()
  @Length(1, 128)
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  @Length(20, 256)
  token!: string;
}

export class MfaCodeDto {
  @Matches(/^\d{6}$/, { message: 'code must contain exactly 6 digits' })
  code!: string;
}

export class DisableMfaDto {
  @IsString()
  @Length(1, 128)
  password!: string;

  @Matches(/^\d{6}$/, { message: 'code must contain exactly 6 digits' })
  code!: string;
}
