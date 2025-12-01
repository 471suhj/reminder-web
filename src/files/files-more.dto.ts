export class FilesMoreDto {
    loadMore: boolean;
    arr: Array<{
        before?: number,
        link: string,
        id: number,
        isFolder: boolean,
        text: string,
        bookmarked: boolean,
        shared: string,
        date: string
    }>
}