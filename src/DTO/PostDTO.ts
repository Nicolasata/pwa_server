import {
    IsString,
    IsNotEmpty,
    IsDefined,
    IsOptional,
} from 'class-validator';

export class Save
{
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    media: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    mediaStr: string;

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