import { UserCommonDto } from "src/user/user-common.dto";

export class FilesGetDto extends UserCommonDto{
    dirName: string;
    dirPath: string;
    countItem: 'true'|'false';
    path: string;
    uplink: string;
    dirId: number
}