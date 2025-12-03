import { SortModeDto } from "./sort-mode.dto";

export class FileMoveDto {
    overwrite?: 'buttonskip'|'buttonoverwrite'|'buttonrename';
    action: 'move'|'copy';
    sort: SortModeDto;
    files: Array<number>;
    from: number;
    timestamp: Date;
    to: number;
}