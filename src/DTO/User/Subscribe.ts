import { IsString, IsDefined, IsNotEmpty } from 'class-validator';

export default class Subscribe
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    userId: string;
}