import { IsString, IsDefined, IsNotEmpty } from 'class-validator';

export default class Save
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    post: string;
    
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    text: string;
}