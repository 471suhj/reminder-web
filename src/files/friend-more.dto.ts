import { FilesArrDto } from "./files-arr.dto";

export class FriendMoreDto {
    addarr: FilesArrDto['arrFriend'];
    loadMore: boolean;
    needRefresh: boolean;
    needReload: boolean; // unused
}