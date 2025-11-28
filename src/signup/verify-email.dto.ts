import { IsNotEmpty, IsString, IsEmail } from "class-validator";

export class VerifyEmailDto {
    @IsString()
    @IsNotEmpty()
    email: string;

    @IsNotEmpty()
    @IsString()
    code: string;
}