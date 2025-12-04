import { FilesArrDto } from "./files-arr.dto";

export class FileShareResDto {
    addarr: FilesArrDto['arr'];
    failreason?: string; // '', undefined both accepted
    failed: Array<number>;
}