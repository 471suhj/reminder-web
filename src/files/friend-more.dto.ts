import { ApiProperty } from "@nestjs/swagger";
import { UserInsertResDto } from "./user-insert-res.dto";

export class FriendMoreDto {

    @ApiProperty({
        type: [UserInsertResDto]
    })
    addarr: UserInsertResDto[];

    @ApiProperty()
    loadMore: boolean;

    @ApiProperty()
    needRefresh: boolean;

    @ApiProperty()
    needReload: boolean;
}