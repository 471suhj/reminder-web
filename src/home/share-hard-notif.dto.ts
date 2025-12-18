export class ShareHardNotifDto {
    sender_ser: number;
    file_name: string;
    mode: 'edit'|'read';
    fileid: number;
    message: string;
}