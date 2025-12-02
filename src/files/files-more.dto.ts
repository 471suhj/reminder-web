export class FilesMoreDto {
    loadMore: boolean;
    arr: Array<{
        link: string;
        id: number;
        isFolder: boolean;
        text: string;
        bookmarked: boolean;
        shared: string;
        date: string;
        ownerImg: string;
    }>;
    needRefresh: boolean;
}