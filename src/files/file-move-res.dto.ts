import { FileIdentResDto } from "./file-ident-res.dto";
import { FilesArrDto } from "./files-arr.dto";

export class FileMoveResDto { // does not ignore 'before'
    addarr: FilesArrDto['arr'] = [];
    delarr: FileIdentResDto[] = [];
    alreadyExists?: boolean;
    failed: [number, string|Date][] = [];
    failmessage?: string;
    expired?: boolean;
}