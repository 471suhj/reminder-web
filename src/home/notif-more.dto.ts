export class NotifMoreDto {
    loadMore: 'false'|'true';
    unreadCnt: number;
    arr: {
        id: string,
        unread: 'true'|'false',
        text: string,
        linkText: string,
        date: string,
        link: string,
    }[];
}