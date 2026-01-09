import { FileIdentResDto } from "./file-ident-res.dto";

export class FilesArrResDto {
    arr: {
        before?: FileIdentResDto;
        link?: string;
        id: number;
        isFolder: boolean;
        text: string;
        bookmarked?: boolean;
        shared?: string;
        date: Date;
        dateShared?: Date;
        dateDeleted?: Date;
        origPath?: string;
        ownerImg?: string;
        ownerName?: string;
        timestamp: Date;
    }[];
    arrFriend: {
        before?: {id: number};
        link: string; // profile/
        id: number;
        profileimg: string;
        nickname: string;
        name: string;
        userid: string;
        sharedFiles: string;
    }[];
}