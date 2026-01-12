import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UserInsertResDto {

    @ApiPropertyOptional({
        type: 'object',
        properties: {
            id: {
                type: 'number'
            }
        }
    })
    before?: {id: number};

    @ApiProperty()
    link: string; // profile/

    @ApiProperty()
    id: number;

    @ApiProperty()
    profileimg: string;

    @ApiProperty()
    nickname: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    userid: string;

    @ApiProperty()
    sharedFiles: string;
}