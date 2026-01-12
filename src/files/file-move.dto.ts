import { IsArray, IsBoolean, IsDate, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";
import { FileIdentReqDto } from "./file-ident-req.dto";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FileMoveDto {
    @ApiPropertyOptional({
        enum: ['buttonskip', 'buttonoverwrite', 'buttonrename'],
        description: '이동 목적지 폴더에 이미 같은 이름의 파일이 있을 경우 파일을 건너뛸지, 덮어쓸지, 이름에 -2를 붙이고 복사/이동할지를 명시합니다.\n\n\
        이 값이 지정되지 않은 상태에서 파일 이름의 충돌이 발생한다면 alreadyExists가 true인 상태의 응답이 반환됩니다.\
        이 경우 사용자에게 어떤 동작을 취할지 확인한 후 해당 란을 채워서 다시 요청을 전송해야 합니다.'
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @IsIn(['buttonskip', 'buttonoverwrite', 'buttonrename'])
    overwrite?: 'buttonskip'|'buttonoverwrite'|'buttonrename';

    @ApiProperty({
        enum: ['move', 'copy'],
        description: '복사, 이동 중 수행할 동작을 입력합니다.'
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['move', 'copy'])
    action: 'move'|'copy';

    @ApiProperty({
        type: SortModeDto,
        description: '현재 파일 목록이 사용하고 있는 정렬 기준을 입력합니다. 폴더의 종류에 따라 입력할 수 있는 값에 차이가 있습니다. 파일 창의 경우 colName, colDate가 허용됩니다.\
        이 정보는 일반적으로 두 가지 방법으로 이용됩니다.\n\n\
        우선 정렬 기준은 뒤의 last와 함께 resolveLoadmore()에 활용됩니다. 즉 아직 로드되지 않았지만 선택한 것으로 간주되는 파일 목록을 파악하는 것에 사용됩니다.\n\n\
        또한 현재 폴더로의 복사 작업으로 인해 현재 표시되는 파일 목록에 새롭게 추가되어야 하는 파일이 발생한 경우 새로운 파일이 어떤 위치에 추가되어 표시되어야 하는지를 이 정렬 기준을 바탕으로 파악하게 됩니다.'
    })
    @IsObject()
    @ValidateNested()
    @Type(()=>SortModeDto)
    sort: SortModeDto;

    @ApiProperty({
        type: [FileIdentReqDto],
        description: '복사 또는 이동 작업이 이루어질 파일 목록을 입력합니다.'
    })
    @IsArray()
    @ValidateNested({each: true})
    @Type(()=>FileIdentReqDto)
    files: FileIdentReqDto[];

    @ApiProperty({
        description: '어떤 폴더에서 호출되었는지 그 출처 폴더의 번호 (file_serial)를 입력합니다. \
        이 정보는 앞의 sort와 마찬가지로 resolveLoadmore()와 새롭게 추가되어야 하는 파일의 위치 파악에 이용됩니다.'
    })
    @IsInt()
    from: number;

    @ApiProperty({
        description: '출처 폴더의 창이 로드된 이후 위치가 이동했거나 이름이 변경되었을 경우에 대비하여 폴더의 로드 당시의 timestamp (last_renamed)를 입력합니다.\
        이 값이 폴더의 현재 last_renamed와 다르다면 경고가 표시됩니다.'
    })
    @Type(()=>Date)
    @IsDate()
    timestamp: Date;

    @ApiProperty({
        description: '이동 또는 복사의 목적지 폴더의 번호를 입력합니다.'
    })
    @IsInt()
    to: number;

    @ApiPropertyOptional({
        description: '이 값이 true일 경우 위의 timestamp 항목과 현재 폴더의 last_renamed가 다르더라도 expired가 true인 응답을 반환하는 대신 작업을 수행합니다.'
    })
    @IsBoolean()
    @IsOptional()
    ignoreTimestamp?: boolean;

    @ApiProperty({
        type: FileIdentReqDto,
        description: '파일 목록에서 마지막에 등장하는 파일의 id, timestamp (last_renamed)를 입력합니다. 이 정보는 resolveLoadmore()에 이용됩니다. \n\n\
        구체적으로는, 파일 창은 첫 20개의 파일만을 처음에 로드하므로, 파일 목록이 아직 모두 로드되지 않은 상태에서 모두 선택을 클릭하면 아직 로드되지 않은 파일 또한 모두 선택된 것으로 간주됩니다. \
        이 경우 로드된 마지막 파일, 즉 last를 바탕으로 files에 명시적으로 나열되지는 않았지만 선택된 것으로 간주되는 파일들의 목록을 파악하게 됩니다.'
    })
    @ValidateNested()
    @Type(()=>FileIdentReqDto)
    @IsObject()
    last: FileIdentReqDto;

    @ApiPropertyOptional({
        description: '이 값은 현재 사용되지 않습니다.'
    })
    @IsOptional()
    @IsBoolean()
    includeShared?: boolean;
}