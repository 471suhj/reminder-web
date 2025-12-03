import { FileDeleteDto } from "src/files/file-delete.dto";

export class SharedDelDto extends FileDeleteDto {
    friend: number;
}