import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FileListResDto {

    @ApiProperty({
        type: 'array',
        items: {
            type: 'object',
            properties: {
                name: {
                    type: 'string'
                },
                id: {
                    type: 'number'
                }
            }
        }
    })
    arr: {name: string, id: number}[];

    @ApiPropertyOptional({
        type: 'array',
        items: {
            type: 'object',
            properties: {
                name: {
                    type: 'string'
                },
                id: {
                    type: 'number'
                },
                timestamp: {
                    type: 'date-time',
                }
            }
        }
    })
    arr2?: {name: string, id: number, timestamp: Date}[];

    @ApiProperty()
    path: string;
}