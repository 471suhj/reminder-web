import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString } from "class-validator";

export class InboxSaveDto {
    @ApiProperty({
        description: '받은 파일 중 저장하고자 하는 파일의 파일 번호를 입력합니다.'
    })
    @IsString()
    id: string;
}