import { Type } from 'class-transformer';
import {
    IsString,
    IsDefined,
    IsUrl,
    IsNotEmpty,
    ValidateNested,
    IsObject,
    IsArray
} from 'class-validator';

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

export class Save
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

export class Delete
{
    @IsDefined()
    @IsArray()
    @IsNotEmpty()
    @IsString({each: true})
    subscriptions: string;
};