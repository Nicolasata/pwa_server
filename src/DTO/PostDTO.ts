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
    media: string;

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