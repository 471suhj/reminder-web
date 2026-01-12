import { ApiProperty } from "@nestjs/swagger";
import { FileInsertResDto } from "./file-insert-res.dto";

export class FileMoreDto { // before is ignored

    @ApiProperty({
        type: [FileInsertResDto]
    })
    addarr: FileInsertResDto[] = [];

    @ApiProperty()
    loadMore: boolean = true;

    @ApiProperty()
    needRefresh: boolean = false;

    @ApiProperty()
    needReload: boolean = false;
}