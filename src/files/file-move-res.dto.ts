import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FileIdentResDto } from "./file-ident-res.dto";
import { FileInsertResDto } from "./file-insert-res.dto";

export class FileMoveResDto { // does not ignore 'before'
    @ApiProperty({
        type: [FileInsertResDto]
    })
    addarr: FileInsertResDto[] = [];

    @ApiProperty({
        type: [FileIdentResDto]
    })
    delarr: FileIdentResDto[] = [];

    @ApiPropertyOptional()
    alreadyExists?: boolean;

    @ApiProperty({
        type: 'array',
        items: {
            type: 'object',
            properties: {
                0: {
                    type: 'number'
                },
                1: {
                    type: 'date-time'
                }
            }
        }
    })
    failed: [number, string|Date][] = [];

    @ApiPropertyOptional()
    failmessage?: string;

    @ApiPropertyOptional()
    expired?: boolean;
}