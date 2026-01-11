import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

export class SortModeDto {

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    criteria: string;

    @ApiProperty()
    @IsBoolean()
    incr: boolean;
}