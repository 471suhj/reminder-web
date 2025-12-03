import { SortModeDto } from "./sort-mode.dto";

export class FileUpdateDto { // createdir: update current folder to have more child directories
    action: 'rename'|'createDir'|'createFile';
    sort: SortModeDto;
    id: number; // id of file/directory
    name: string;
    timestamp: Date;
}