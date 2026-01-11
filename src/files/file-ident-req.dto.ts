import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsInt } from "class-validator";

export class FileIdentReqDto {

    @ApiProperty()
    @IsInt()
    id: number;

    @ApiProperty()
    @Type(()=>Date)
    @IsDate()
    timestamp: Date;
}