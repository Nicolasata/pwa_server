import { IsString, IsNotEmpty, IsDefined } from 'class-validator';

export default class Edit
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    description: string;
}