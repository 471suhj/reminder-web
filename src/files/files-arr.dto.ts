import { FileIdentResDto } from "./file-ident-res.dto";

export class FilesArrDto {
    arr: {
        before?: FileIdentResDto;
        link?: string;
        id: number;
        isFolder: boolean;
        text: string;
        bookmarked?: boolean;
        shared?: string;
        date: string;
        dateDeleted?: string;
        origPath?: string;
        ownerImg?: string;
        ownerName?: string;
        timestamp: string;
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