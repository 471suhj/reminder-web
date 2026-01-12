import { ApiProperty } from "@nestjs/swagger";
import { UserCommonDto } from "src/user/user-common.dto";

export class FileGetResDto extends UserCommonDto{

    @ApiProperty()
    dirName: string;

    @ApiProperty()
    dirPath: string;

    @ApiProperty()
    path: string;

    @ApiProperty()
    uplink: string;

    @ApiProperty()
    dirId: number;

    @ApiProperty()
    timestamp: string;
}