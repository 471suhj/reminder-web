import { Type } from "class-transformer";
import { IsDate, IsInt } from "class-validator";

export class FileIdentReqDto {

    @IsInt()
    id: number;

    @Type(()=>Date)
    @IsDate()
    timestamp: Date;
}