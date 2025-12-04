import { SortModeDto } from "./sort-mode.dto";

export class FileDeleteDto {
    action: 'selected'|'restore'|'bookmark'|'unshare'|'permdel';
    files: Array<{id: number, timestamp: Date}>;
    // when unsharing only
    message?: string;
    // for files only
    timestamp?: Date; // file only
    from?: number; // file only
    ignoreTimpstamp?: boolean; // file delete/unshare only
}