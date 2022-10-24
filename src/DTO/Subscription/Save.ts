import { IsString, IsDefined, IsUrl, IsNotEmpty, ValidateNested, IsObject  } from 'class-validator';
import { Type } from 'class-transformer';

export class Keys
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    auth: string;

    @IsDefined()
    @IsString()
    @IsNotEmpty()
    p256dh: string;
}

export default class Save
{
    @IsDefined()
    @IsString()
    @IsUrl()
    endpoint: string;

    @IsDefined()
    @IsObject()
    @ValidateNested()
    @Type(() => Keys)
    keys: Keys
};