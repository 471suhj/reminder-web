import { SortModeDto } from "./sort-mode.dto";

export class FileMoveDto {
    overwrite?: 'buttonskip'|'buttonoverwrite'|'buttonrename';
    action: 'move'|'copy';
    sort: SortModeDto;
    files: Array<{id: number, timestamp: Date}>;
    from: number;
    timestamp?: Date; // file only
    to: number;
    ignoreTimpstamp?: boolean;
}