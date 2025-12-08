import { FileIdentReqDto } from "./file-ident-req.dto";
import { SortModeDto } from "./sort-mode.dto";

export class FileShareDto {
    files: Array<FileIdentReqDto>;
    mode: 'copy'|'read'|'edit';
    message: string;
    friends: Array<number>;
    last: FileIdentReqDto;
    sort?: SortModeDto;
}