import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FileIdentResDto } from "./file-ident-res.dto";
import { FileInsertResDto } from "./file-insert-res.dto";

export class FileShareResDto {
    @ApiProperty({
        type: [FileInsertResDto]
    })
    addarr: FileInsertResDto[] = [];

    @ApiProperty({
        type: [FileIdentResDto]
    })
    delarr: FileIdentResDto[] = [];

    @ApiPropertyOptional()
    failreason?: string; // '', undefined both accepted

    @ApiProperty({
        type: [FileIdentResDto]
    })
    failed: FileIdentResDto[] = [];
}