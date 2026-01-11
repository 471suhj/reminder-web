import { IsArray, IsBoolean, IsDate, IsIn, IsInstance, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { FileIdentReqDto } from "./file-ident-req.dto";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FileDeleteDto {
    // unsharing from certain profile must hava dirid, from shared folder shouldn't
    @ApiProperty({
        enum: ['selected', 'restore', 'bookmark', 'unshare', 'permdel'],
        description: '수행할 작업을 입력합니다. 이 Dto는 여러 명령에서 공동으로 사용됩니다. 각 작업에 따라 허용되는 값 (동작)이 다르며, 구체적으로는 다음과 같습니다.\n\n\
        Del(recycle): permdel (영구 삭제)만 허용됩니다.\n\n\
        Put(recycle): restore (삭제된 파일 복원)만 허용됩니다.\n\n\
        Del(manage 및 bookmark): selected (선택된 파일 삭제), unshare (선택된 파일 공유 취소), bookmark (바로 가기 해제)만 허용됩니다. 호출의 편의를 위해 두 명령은 동일한 기능을 수행합니다.\n\n\
        Put(bookmark): bookmark (바로 가기에 추가)만 허용됩니다.\n\n\
        '
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['selected', 'restore', 'bookmark', 'unshare', 'permdel'])
    action: 'selected'|'restore'|'bookmark'|'unshare'|'permdel';

    @ApiProperty({
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: {
                    type: 'number'
                },
                timestamp: {
                    type: 'string',
                    example: '2026-01-10T14:17:26.771Z'
                }
            }
        },
        description: '작업을 수행할 대상 파일의 목록을 입력합니다.'
    })
    @IsArray()
    @ValidateNested({each: true})
    @Type(()=>FileIdentReqDto)
    files: FileIdentReqDto[];
    
    // when unsharing only
    @ApiPropertyOptional({
        description: '공유 취소 작업을 하는 경우 공유 취소를 통보받는 사용자에게 전송할 메시지를 입력합니다. 메시지가 빈 문자열이거나 undefined인 경우 상대에게 알림이 전송되지 않습니다.'
    })
    @IsOptional()
    @IsString()
    message?: string;

    @ApiPropertyOptional({
        description: 'selected 작업에서는 필수 항목이며, 나머지 작업에서는 무시됩니다. 출처 폴더의 timestamp (last_renamed)를 입력합니다.\n\n\
        아래 ignoreTimestamp 항목이 true가 아닌 상태에서 호출될 경우 폴더의 현재 timestamp (last_renamed)와 입력된 값이 다를 경우 작업을 진행하지 않고 expired가 true인 응답을 반환합니다.'
    })
    @IsOptional()
    @IsDate()
    @Type(()=>Date)
    timestamp?: Date; // file only

    @ApiPropertyOptional({
        description: 'selected 작업에서는 필수 항목이며, unshare 작업에서는 프로필 창에서 명령을 호출한 경우에만 필수 항목입니다. \n\n\
        selected의 경우 명령이 호출된 폴더의 번호 (file_serial)를, unshare의 경우 명령이 호출된 프로필 창의 친구의 사용자 번호 (user_serial)를 입력합니다.'
    })
    @IsOptional()
    @IsInt()
    from?: number; // file/unshare(optional) only

    @ApiPropertyOptional({
        description: 'selected에서만 선택 항목이며, 나머지 작업에서는 무시됩니다.\n\n\
        selected에서 위의 timestamp가 해당 폴더의 현재 timestamp (last_renamed)와 다를 경우 ignoreTimestamp가 true가 아니라면 작업을 수행하지 않고 expired가 true인 응답을 반환합니다.'
    })
    @IsOptional()
    @IsBoolean()
    ignoreTimestamp?: boolean; // file delete only

    @ApiProperty({
        type: 'object',
        properties: {
            id: {
                type: 'number'
            },
            timestamp: {
                type: 'string',
                example: '2026-01-10T14:17:26.771Z'
            }
        },
        description: '파일 목록에서 마지막에 등장하는 파일의 id, timestamp (last_renamed)를 입력합니다. 이 정보는 resolveLoadmore()에 이용됩니다. \n\n\
        구체적으로는, 파일 창은 첫 20개의 파일만을 처음에 로드하므로, 파일 목록이 아직 모두 로드되지 않은 상태에서 모두 선택을 클릭하면 아직 로드되지 않은 파일 또한 모두 선택된 것으로 간주됩니다. \
        이 경우 로드된 마지막 파일, 즉 last를 바탕으로 files에 명시적으로 나열되지는 않았지만 선택된 것으로 간주되는 파일들의 목록을 파악하게 됩니다.'
    })
    @IsObject()
    @ValidateNested()
    @Type(()=>FileIdentReqDto)
    last: FileIdentReqDto;

    @ApiProperty({
        type: 'object',
        properties: {
            criteria: {
                type: 'string'
            },
            incr: {
                type: 'boolean'
            }
        },
        description: '현재 파일 목록이 사용하고 있는 정렬 기준을 입력합니다. 폴더의 종류에 따라 입력할 수 있는 값에 차이가 있습니다. 파일 창의 경우 colName, colDate가 허용됩니다.\n\n\
        이 정보는 앞의 last와 함께 resolveLoadmore()에 활용됩니다. 즉 아직 로드되지 않았지만 선택한 것으로 간주되는 파일 목록을 파악하는 것에 사용됩니다.'
    })
    @IsObject()
    @ValidateNested()
    @Type(()=>SortModeDto)
    sort: SortModeDto;
}