import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsInstance } from "class-validator";
import { KeyObject } from "node:crypto";

export class GetPWDto {
    @IsNotEmpty()
    @IsString()
    id: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsOptional()
    key?: KeyObject;

    @IsOptional()
    @IsBoolean()
    nokey?: boolean;
}