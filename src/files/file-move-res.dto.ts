import { FilesArrDto } from "./files-arr.dto";

export class FileMoveResDto extends FilesArrDto{ // does not ignore 'before'
    alreadyExists?: boolean;
    failed?: boolean;
    failmessage?: string;
}