export class FileListResDto {
    arr: Array<{name: string, id: number}>;
    arr2?: Array<{name: string, id: number, timestamp: Date}>;
    path: string;
}