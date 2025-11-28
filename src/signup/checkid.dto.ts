import { IsNotEmpty, IsString } from "class-validator";

export class CheckidDto{
    @IsNotEmpty()
    @IsString()
    id: string;
}