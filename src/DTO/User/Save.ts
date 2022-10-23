import { IsString, MinLength, IsEmail, IsDefined, IsNotEmpty } from 'class-validator';
import { HasNumber } from '../CustomDecorator/HasNumber';
import { HasUppercase } from '../CustomDecorator/HasUppercase';

export default class Save
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
}