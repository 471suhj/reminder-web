import { IsNotEmpty, IsString, IsEmail, IsOptional, IsBoolean, Length } from "class-validator";
import { KeyObject } from "node:crypto";


export class RegisterDto{
    @IsNotEmpty()
    @IsString()
    @Length(7, 25)
    id: string;

    @IsNotEmpty()
    @IsString()
    @Length(7, 30)
    password: string;

    @IsNotEmpty()
    @IsString()
    @Length(1, 25)
    username: string;

    @IsNotEmpty()
    @IsString()
    @IsEmail()
    @Length(1, 320)
    email: string;

    @IsOptional()
    key?: KeyObject;

    @IsOptional()
    @IsBoolean()
    nokey?: boolean;
}