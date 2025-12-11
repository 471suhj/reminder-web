import { IsBoolean, IsString } from "class-validator";

export class PrefCheckedDto {

    @IsString()
    action: string;

    @IsBoolean()
    checked: boolean;
}