import { FileIdentResDto } from "./file-ident-res.dto";
import { FilesArrResDto } from "./files-arr-res.dto";

export class FileShareResDto {
    addarr: FilesArrResDto['arr'] = [];
    delarr: FileIdentResDto[] = [];
    failreason?: string; // '', undefined both accepted
    failed: FileIdentResDto[] = [];
}