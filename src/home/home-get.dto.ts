import { UserCommonDto } from "src/user/user-common.dto";

export class HomeGetDto extends UserCommonDto {
    homeList: {
        link: string,
        title: string,
        itemList: ['A'|'B', number, string, 'false'|'notif'|'newwin', string][] // ab, no., caption, popup, link
    }[];
}