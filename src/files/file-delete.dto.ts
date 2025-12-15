import { IsArray, IsBoolean, IsDate, IsIn, IsInstance, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { FileIdentReqDto } from "./file-ident-req.dto";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";

export class FileDeleteDto {
    // unsharing from certain profile must hava dirid, from shared folder shouldn't
    @IsString()
    @IsNotEmpty()
    @IsIn(['selected', 'restore', 'bookmark', 'unshare', 'permdel'])
    action: 'selected'|'restore'|'bookmark'|'unshare'|'permdel';

    @IsArray()
    @ValidateNested({each: true})
    @Type(()=>FileIdentReqDto)
    files: FileIdentReqDto[];
    
    // when unsharing only
    @IsOptional()
    @IsString()
    message?: string;

    @IsOptional()
    @IsDate()
    @Type(()=>Date)
    timestamp?: Date; // file only

    @IsOptional()
    @IsInt()
    from?: number; // file only

    @IsOptional()
    @IsBoolean()
    ignoreTimestamp?: boolean; // file delete/unshare only

    @IsObject()
    @ValidateNested()
    @Type(()=>FileIdentReqDto)
    last: FileIdentReqDto;

    @IsObject()
    @ValidateNested()
    @Type(()=>SortModeDto)
    sort: SortModeDto;
}