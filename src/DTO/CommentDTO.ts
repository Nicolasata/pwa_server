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
    postId: string;
    
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