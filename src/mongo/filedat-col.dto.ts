export class FiledatColDto {
    serial: number;
    type: 'rmb0.2'|'rmb0.3';
    metadata: {Interval?: number, FontSize?: number, RemStart?: number, RemEnd?: number};
    arr: string[];
}