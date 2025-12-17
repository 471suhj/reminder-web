import { IsNotEmpty, IsString, IsEmail, IsOptional, IsBoolean, Length, IsObject } from "class-validator";
import { KeyObject } from "node:crypto";


export class RegisterDto{
    @IsNotEmpty()
    @IsString()
    @Length(7, 25)
    id: string;

    @IsNotEmpty()
    @IsString()
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

    @IsString()
    @IsNotEmpty()
    emailkey: string;

    @IsOptional()
    @IsObject()
    key?: KeyObject;

    @IsOptional()
    @IsBoolean()
    nokey?: boolean;
}