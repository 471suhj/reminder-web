export class NotifMoreDto {
    loadMore: 'false'|'true';
    arr: {
        id: string,
        unread: 'true'|'false',
        text: string,
        date: string,
    }[];
}