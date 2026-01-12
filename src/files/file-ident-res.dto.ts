import { ApiProperty } from "@nestjs/swagger";

export class FileIdentResDto {
    @ApiProperty()
    id: number;

    @ApiProperty({
        type: Date
    })
    timestamp: Date|string;
}