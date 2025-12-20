import { NotifType } from "src/home/notif-type.type";

export class NotifColDto {
	read: boolean;
	to: number;
	type: NotifType['itm'];
	data: object;
	urlArr: [string, string][];
}