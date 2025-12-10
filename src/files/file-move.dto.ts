import { IsArray, IsBoolean, IsDate, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";
import { FileIdentReqDto } from "./file-ident-req.dto";

export class FileMoveDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @IsIn(['buttonskip', 'buttonoverwrite', 'buttonrename'])
    overwrite?: 'buttonskip'|'buttonoverwrite'|'buttonrename';

    @IsString()
    @IsNotEmpty()
    @IsIn(['move', 'copy'])
    action: 'move'|'copy';

    @ValidateNested()
    @Type(()=>SortModeDto)
    sort: SortModeDto;

    @IsArray()
    @ValidateNested({each: true})
    @Type(()=>FileIdentReqDto)
    files: FileIdentReqDto[];

    @IsInt()
    from: number;

    @Type(()=>Date)
    @IsDate()
    timestamp: Date;

    @IsInt()
    to: number;

    @IsBoolean()
    ignoreTimpstamp: boolean;

    @IsInt()
    last: number;
}