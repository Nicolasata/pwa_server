import { HasNumber } from './CustomDecorator/HasNumber';
import { HasUppercase } from './CustomDecorator/HasUppercase';
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
    username: string;

    @IsDefined()
    @IsString()
    @IsEmail()
    @IsNotEmpty()
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
};

export class Follow
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    userId: string;
};