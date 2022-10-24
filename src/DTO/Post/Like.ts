import { IsBoolean, IsDefined } from 'class-validator';

export default class Like
{
    @IsDefined()
    @IsBoolean()
    isLiked: boolean;
}