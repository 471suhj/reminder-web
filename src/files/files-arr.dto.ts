export class FilesArrDto {
    arr: Array<{
        before?: number;
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