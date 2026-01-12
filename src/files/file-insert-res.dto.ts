import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FileIdentResDto } from "./file-ident-res.dto";

export class FileInsertResDto {
    @ApiPropertyOptional({
        type: FileIdentResDto
    })
    before?: FileIdentResDto;

    @ApiPropertyOptional()
    link?: string;

    @ApiProperty()
    id: number;

    @ApiProperty()
    isFolder: boolean;

    @ApiProperty()
    text: string;

    @ApiPropertyOptional()
    bookmarked?: boolean;

    @ApiPropertyOptional()
    shared?: string;

    @ApiProperty()
    date: Date;

    @ApiPropertyOptional()
    dateShared?: Date;

    @ApiPropertyOptional()
    dateDeleted?: Date;

    @ApiPropertyOptional()
    origPath?: string;

    @ApiPropertyOptional()
    ownerImg?: string;

    @ApiPropertyOptional()
    ownerName?: string;

    @ApiProperty()
    timestamp: Date;
}