import { UserCommonDto } from "src/user/user-common.dto";

export class FilesGetResDto extends UserCommonDto{
    dirName: string;
    dirPath: string;
    path: string;
    uplink: string;
    dirId: number;
    timestamp: string;
}