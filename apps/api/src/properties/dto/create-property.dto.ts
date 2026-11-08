import { IsIanaTimeZone } from '../../common/validators/is-iana-timezone.validator';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,24}$/, {
    message: 'code must contain 2-24 letters, digits, hyphens or underscores',
  })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIanaTimeZone()
  timezone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currencyCode must be a 3-letter ISO code' })
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'operationalDayStart must use HH:mm (00:00-23:59)',
  })
  operationalDayStart?: string;
}
