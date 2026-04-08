import { IsEmail, IsString, MinLength, MaxLength, Matches, IsEnum, IsOptional } from 'class-validator';

export enum RegistrationIndustry {
  FINTECH = 'FINTECH',
  SAAS = 'SAAS',
  LOGISTICS = 'LOGISTICS',
  ECOMMERCE = 'ECOMMERCE',
  OTHER = 'OTHER',
}

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  organizationName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

  @IsEnum(RegistrationIndustry)
  industry!: RegistrationIndustry;
}
