import { IsNotEmpty, IsString, IsEmail } from "class-validator";

export class EmailDto{
    @IsNotEmpty()
    @IsString()
    @IsEmail()
    email: string;
}