import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FileIdentResDto } from "./file-ident-res.dto";

export class FileDelResDto {
    @ApiProperty({
        type: [FileIdentResDto]
    })
    delarr: FileIdentResDto[] = [];

    @ApiProperty({
        type: [FileIdentResDto]
    })
    failed: FileIdentResDto[] = [];

    @ApiPropertyOptional()
    failmessage?: string; // '', undefined both accepted

    @ApiPropertyOptional()
    alreadyExists?: boolean; // restoring only, rename with '-2' appended without rollback

    @ApiPropertyOptional()
    expired?: boolean; // file only
}