import { SortModeDto } from "./sort-mode.dto";

export class FileUpdateDto { // createdir: update current folder to have more child directories
    action: 'rename'|'createDir'|'createFile';
    sort: SortModeDto;
    id: number; // id of directory
    file?: number; // for rename only
    name: string;
    timestamp: Date;
}