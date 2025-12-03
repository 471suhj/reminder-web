import { UserCommonDto } from "src/user/user-common.dto";

export class ProfileGetDto extends UserCommonDto{
    friendNickname: string;
    friendName: string;
    friendID: string;
    friendImg: string;
    profId: number;
    dateAdded: string;
    dateShared: string;
}