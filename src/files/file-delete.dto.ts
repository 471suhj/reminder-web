import { FileIdentReqDto } from "./file-ident-req.dto";
import { SortModeDto } from "./sort-mode.dto";

export class FileDeleteDto {
    // unsharing from certain profile must hava dirid, from shared folder shouldn't
    action: 'selected'|'restore'|'bookmark'|'unshare'|'permdel';
    files: Array<{id: number, timestamp: Date}>;
    // when unsharing only
    message?: string;
    timestamp?: Date; // file only
    from?: number; // file only
    ignoreTimpstamp?: boolean; // file delete/unshare only
    last: FileIdentReqDto;
    sort: SortModeDto;
}