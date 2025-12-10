import { IsNumber } from "class-validator";
import { FileDeleteDto } from "src/files/file-delete.dto";

export class SharedDelDto extends FileDeleteDto {
    @IsNumber()
    friend: number;
}