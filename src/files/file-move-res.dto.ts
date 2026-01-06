import { FileIdentResDto } from "./file-ident-res.dto";
import { FilesArrResDto } from "./files-arr-res.dto";

export class FileMoveResDto { // does not ignore 'before'
    addarr: FilesArrResDto['arr'] = [];
    delarr: FileIdentResDto[] = [];
    alreadyExists?: boolean;
    failed: [number, string|Date][] = [];
    failmessage?: string;
    expired?: boolean;
}