import { IsArray, IsDate, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { FileIdentReqDto } from "./file-ident-req.dto";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FileShareDto {

    @ApiProperty({
        type: [FileIdentReqDto],
        description: '공유할 파일의 id와 timestamp (last_renamed)로 구성된 object의 배열'
    })
    @IsArray()
    @ValidateNested({each: true})
    @Type(()=>FileIdentReqDto)
    files: FileIdentReqDto[];

    @ApiProperty({
        enum: ['copy', 'read', 'edit'],
        description: '사본 공유, 읽기 권한 공유, 편집 권한 공유 중 공유 방식을 명시합니다.'
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['copy', 'read', 'edit'])
    mode: 'copy'|'read'|'edit';

    @ApiProperty({
        description: '수신자에게 전달할 메시지를 입력합니다.'
    })
    @IsString()
    message: string;

    @ApiProperty({
        type: [Number],
        description: '공유할 친구의 user_serial들을 입력합니다.'
    })
    @IsArray()
    @IsInt({each: true})
    friends: number[];

    @ApiProperty({
        type: FileIdentReqDto,
        description: '파일 목록에서 마지막에 등장하는 파일의 id, timestamp (last_renamed)를 입력합니다. 이 정보는 resolveLoadmore()에 이용됩니다. \n\n\
        구체적으로는, 파일 창은 첫 20개의 파일만을 처음에 로드하므로, 파일 목록이 아직 모두 로드되지 않은 상태에서 모두 선택을 클릭하면 아직 로드되지 않은 파일 또한 모두 선택된 것으로 간주됩니다. \
        이 경우 로드된 마지막 파일, 즉 last를 바탕으로 files에 명시적으로 나열되지는 않았지만 선택된 것으로 간주되는 파일들의 목록을 파악하게 됩니다.'
    })
    @IsObject()
    @ValidateNested()
    @Type(()=>FileIdentReqDto)
    last: FileIdentReqDto;

    @ApiProperty({
        type: SortModeDto,
        description: '현재 파일 목록이 사용하고 있는 정렬 기준을 입력합니다. 폴더의 종류에 따라 입력할 수 있는 값에 차이가 있습니다. 파일 창의 경우 colName, colDate가 허용됩니다.\
        이 정보는 일반적으로 두 가지 방법으로 이용됩니다.\n\n\
        우선 정렬 기준은 앞의 last와 함께 resolveLoadmore()에 활용됩니다. 즉 아직 로드되지 않았지만 선택한 것으로 간주되는 파일 목록을 파악하는 것에 사용됩니다.\n\n\
        또한 공유 작업으로 인해 현재 표시되는 파일 목록에 새롭게 추가되어야 하는 파일이 발생한 경우 새로운 파일이 어떤 위치에 추가되어 표시되어야 하는지를 이 정렬 기준을 바탕으로 파악하게 됩니다.\
        사용자의 파일 목록에서 이 API를 호출할 경우에는 새롭게 추가될 파일이 존재하지 않지만, 친구의 프로필 창에서 공유를 진행하는 경우 공유가 이루어진 파일이 목록에 추가로 표시되게 됩니다.'
    })
    @IsObject()
    @ValidateNested()
    @Type(()=>SortModeDto)
    sort: SortModeDto;

    @ApiProperty({
        description: '어떤 폴더에서 호출되었는지 그 출처를 입력합니다. source에 따라 이 번호는 두 가지 의미를 가질 수 있습니다.\n\n\
        우선, source가 files라면 API가 files 창에서 호출되었음을 의미하며, 이 from은 출처 폴더의 번호 (file_serial)를 의미합니다.\n\n\
        반면 source가 profile인 경우 API가 친구 프로필 창에서 호출되었음을 의미하며, 이 from은 API 호출이 진행된 친구의 사용자 번호 (user_serial)을 의미합니다.\
        이 정보는 앞의 sort와 마찬가지로 resolveLoadmore()와 새롭게 추가되어야 하는 파일의 위치 파악에 이용됩니다.'
    })
    @IsInt()
    from: number;

    @ApiProperty({
        enum: ['files', 'profile'],
        description: '이 API가 파일 목록 창에서 호출되었는지, 친구의 프로필 창에서 호출되었는지를 입력합니다. 이 값에 따라 from이 user_serial로 해석되는지 file_serial로 해석되는지 결정됩니다.'
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['files', 'profile'])
    source: 'files'|'profile';

    @ApiPropertyOptional({
        description: 'source가 files일 경우에는 필수 항목이며, profile일 경우에는 무시됩니다.\n\n\
        출처 폴더의 창이 로드된 이후 위치가 이동했거나 이름이 변경되었을 경우에 대비하여 폴더의 로드 당시의 timestamp (last_renamed)를 입력합니다.\
        이 값이 폴더의 현재 last_renamed와 다를 때 작업이 진행되지 않고 expired가 true인 응답이 반환되는 다른 작업과 달리, 이 작업의 경우 resolveLoadmore()가 이루어지지 않는 것 외에는 작업이 원활히 진행됩니다.\n\n\
        profile일 경우에는 친구/사용자는 last_renamed의 개념이 없기 때문에 해당 값이 무시됩니다.'
    })
    @IsDate()
    @Type(()=>Date)
    timestamp?: Date;
}