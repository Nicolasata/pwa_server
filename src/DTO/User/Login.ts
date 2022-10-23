import { IsString, IsDefined, IsNotEmpty} from 'class-validator';

export default class Login
{
    @IsDefined()
    @IsString()
    @IsNotEmpty()
    identifier: string;

    @IsDefined()
    @IsString()
    @IsNotEmpty()
    password: string;
}