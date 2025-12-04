import { FilesArrDto } from "./files-arr.dto";

export class FileMoveResDto { // does not ignore 'before'
    addarr: FilesArrDto['arr'];
    delarr: {id: number, timestamp: string}[];
    alreadyExists?: boolean;
    failed?: boolean;
    failmessage?: string;
    expired?: boolean;
}