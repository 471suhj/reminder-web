export class UserCommonDto {
    username: string;
    notificationCnt: number;
    sideItem: Array<[link: string, Sel: string, icon: string, caption: string]>;
    countItem: 'true'|'false';
}