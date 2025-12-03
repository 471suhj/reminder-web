import { FilesArrDto } from "./files-arr.dto";

export class FileShareResDto extends FilesArrDto{
    failreason?: string; // '', undefined both accepted
    failed: Array<number>;
}