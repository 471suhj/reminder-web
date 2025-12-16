import { FilesArrDto } from "./files-arr.dto";

export class FileMoveResDto { // does not ignore 'before'
    addarr: FilesArrDto['arr'] = [];
    delarr: {id: number, timestamp: string|Date}[] = [];
    alreadyExists?: boolean;
    failed: [number, string][] = [];
    failmessage?: string;
    expired?: boolean;
}