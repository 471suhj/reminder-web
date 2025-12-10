import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

export class SortModeDto {

    @IsString()
    @IsNotEmpty()
    criteria: string;

    @IsBoolean()
    incr: boolean;
}