export class FileDeleteDto {
    action: 'selected'|'restore'|'bookmark'|'unshare'|'permdel';
    files: Array<{id: number, timestamp: Date}>;
    // when unsharing only
    message?: string;
    timestamp?: Date; // file only
    from?: number; // file only
    ignoreTimpstamp?: boolean; // file delete/unshare only
}