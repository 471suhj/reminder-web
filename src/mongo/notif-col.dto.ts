export class NotifColDto {
	read: boolean;
	to: number;
	type: 'file_shared_hard'|'file_shared_inbox'|'friend_request'|'friend_request_accepted'|'friend_request_rejected';
	data: object;
	urlArr: [string, string][];
}