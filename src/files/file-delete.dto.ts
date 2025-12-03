import { SortModeDto } from "./sort-mode.dto";

export class FileDeleteDto {
    action: 'selected'|'restore'|'bookmark';
    files: Array<{id: number, timestamp: Date}>;
    // when unsharing only
    message?: string;
}