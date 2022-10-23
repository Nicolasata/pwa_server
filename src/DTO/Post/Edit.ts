import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export default class Edit
{
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    description: string;
}