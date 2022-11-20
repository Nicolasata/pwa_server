import { HasNumber } from './CustomDecorator/HasNumber';
import { HasUppercase } from './CustomDecorator/HasUppercase';
import { Trim } from 'class-sanitizer';
import {
    IsString,
    IsOptional,
    IsNotEmpty,
    IsDefined,
    IsEmail,
    MinLength
} from 'class-validator';

export class Save
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    @Trim()
    username: string;

    @IsDefined()
    @IsString()
    @IsEmail()
    @IsNotEmpty()
    @Trim()
    email: string;

    @IsDefined()
    @IsString()
    @MinLength(8)
    @HasUppercase()
    @HasNumber()
    password: string;
};

export class Login
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    identifier: string;

    @IsDefined()
    @IsString()
    @IsNotEmpty()
    password: string;
}

export class Edit
{
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    username: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    description: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    media: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    mediaStr: string;
};