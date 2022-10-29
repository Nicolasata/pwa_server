import {
    IsString,
    IsNotEmpty,
    IsDefined,
    IsBoolean
} from 'class-validator';

export class Save
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    description: string;
};

export class Edit
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    description: string;
};

export class Like
{
    @IsDefined()
    @IsBoolean()
    isLiked: boolean;
};