import { FileIdentReqDto } from "./file-ident-req.dto";

export class FileShareDto {
    files: Array<FileIdentReqDto>;
    mode: 'copy'|'read'|'edit';
    message: string;
    friends: Array<number>;
}