import { IsDate, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Length, ValidateNested } from "class-validator";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";
import { FileIdentReqDto } from "./file-ident-req.dto";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FileUpdateDto { // createdir: update current folder to have more child directories

    @ApiProperty({
        enum: ['rename', 'createDir', 'createFile'],
        description: '수행하려는 작업이 이름 바꾸기, 폴더 생성, 파일 생성 중 무엇인지 입력합니다.'
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['rename', 'createDir', 'createFile'])
    action: 'rename'|'createDir'|'createFile';

    @ApiProperty({
        type: SortModeDto,
        description: '현재 파일 목록이 사용하고 있는 정렬 기준을 입력합니다. 폴더의 종류에 따라 입력할 수 있는 값에 차이가 있습니다. 파일 창의 경우 colName, colDate가 허용됩니다.\
        새롭게 추가되는, 또는 이름이 바뀐 파일이 어떤 위치에 추가되어 표시되어야 하는지를 이 정렬 기준을 바탕으로 파악하게 됩니다.'
    })
    @IsObject()
    @ValidateNested()
    @Type(()=>SortModeDto)
    sort: SortModeDto;

    @ApiProperty({
        description: '작업이 진행되는 폴더의 번호 (file_serial)를 입력합니다.'
    })
    @IsInt()
    id: number; // id of directory

    @ApiPropertyOptional({
        type: FileIdentReqDto,
        description: '이름 바꾸기의 경우 필수 항목, 나머지 작업의 경우 무시됩니다. 이름을 바꾸려는 파일의 파일 번호 (file_serial), timestamp (last_renamed) 정보를 입력합니다.'
    })
    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(()=>FileIdentReqDto)
    file?: FileIdentReqDto; // for rename only

    @ApiProperty({
        description: '이름 바꾸기의 경우 새로 바꾸려는 이름, 파일/폴더 생성의 경우 생성파는 파일/폴더의 이름을 입력합니다.'
    })
    @IsString()
    @IsNotEmpty()
    @Length(1, 40)
    name: string;

    @ApiProperty({
        description: '작업을 시행하는 폴더의 timestamp (last_renamed) 정보를 입력합니다.\
        그러나 해당 값이 폴더의 현재 last_renamed와 다를 경우 작업을 진행하지 않고 expired가 true인 응답을 반환하는 다른 작업들과 달리 해당 명령은 현재 이 항목을 완전히 무시합니다.'
    })
    @IsDate()
    @Type(()=>Date)
    timestamp: Date;
}