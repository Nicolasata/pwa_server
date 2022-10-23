import { IsString, IsDefined, IsUrl, IsNotEmpty } from 'class-validator';

export default class Save
{
    @IsDefined()
    @IsString()
    @IsUrl()
    endpoint: string;

    @IsDefined()
    @IsString()
    @IsNotEmpty()
    auth: string;

    @IsDefined()
    @IsString()
    @IsNotEmpty()
    p256dh: string;
}