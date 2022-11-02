import {
    IsString,
    IsNotEmpty,
    IsDefined
} from 'class-validator';

export class Save
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    post: string;
    
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    text: string;
};

export class Edit
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    text: string;
};