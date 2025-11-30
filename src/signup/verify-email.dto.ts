import { IsNotEmpty, IsString, IsEmail, Length } from "class-validator";

export class VerifyEmailDto {
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    @Length(3, 320)
    email: string;

    @IsNotEmpty()
    @IsString()
    code: string;
}