import { FilesArrResDto } from "./files-arr-res.dto";

export class FriendMoreDto {
    addarr: FilesArrResDto['arrFriend'];
    loadMore: boolean;
    needRefresh: boolean;
    needReload: boolean; // unused
}