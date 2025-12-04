import { FileIdentResDto } from "./file-ident-res.dto";

export class FilesArrDto {
    arr: Array<{
        before?: FileIdentResDto;
        link: string;
        id: number;
        isFolder: boolean;
        text: string;
        bookmarked: boolean;
        shared: string;
        date: string;
        ownerImg: string;
        timestamp: string;
    }>;
}