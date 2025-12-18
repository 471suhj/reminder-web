import { FileIdentResDto } from "./file-ident-res.dto";
import { FilesArrDto } from "./files-arr.dto";

export class FileShareResDto {
    addarr: FilesArrDto['arr'] = [];
    delarr: FileIdentResDto[] = [];
    failreason?: string; // '', undefined both accepted
    failed: FileIdentResDto[] = [];
}