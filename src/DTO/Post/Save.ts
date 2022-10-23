import { IsString, IsDefined, IsNotEmpty } from 'class-validator';

export default class Save
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    description: string;
}