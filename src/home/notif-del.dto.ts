import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

export class NotifDelDto {

    @IsString()
    @IsIn(['selected', 'all'])
    action: 'selected'|'all';

    @IsArray()
    @IsString({each: true})
    @IsOptional()
    files?: string[];

    @IsString()
    @IsOptional()
    first?: string;
}