import { IsNotEmpty, IsString, IsEmail, Length } from "class-validator";

export class EmailDto{
    @IsNotEmpty()
    @IsString()
    @IsEmail()
    @Length(3, 320)
    email: string;
}