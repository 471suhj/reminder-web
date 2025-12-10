import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsInstance, IsObject } from "class-validator";
import { KeyObject } from "node:crypto";

export class GetPWDto {
    @IsNotEmpty()
    @IsString()
    id: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsOptional()
    @IsObject()
    key?: KeyObject;

    @IsOptional()
    @IsBoolean()
    nokey?: boolean;
}