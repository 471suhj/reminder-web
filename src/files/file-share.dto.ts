export class FileShareDto {
    files: Array<number>;
    mode: 'copy'|'read'|'edit';
    message: string;
    friends: Array<{id: number, timestamp: Date}>;
}