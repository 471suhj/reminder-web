import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";
import { FileIdentReqDto } from "./file-ident-req.dto";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";

export class FileShareDto {

    @IsArray()
    @ValidateNested({each: true})
    @Type(()=>FileIdentReqDto)
    files: FileIdentReqDto[];

    @IsString()
    @IsNotEmpty()
    @IsIn(['copy', 'read', 'edit'])
    mode: 'copy'|'read'|'edit';

    @IsString()
    message: string;

    @IsArray()
    @IsInt({each: true})
    friends: number[];

    @ValidateNested()
    @Type(()=>FileIdentReqDto)
    last: FileIdentReqDto;

    @ValidateNested()
    @Type(()=>SortModeDto)
    sort: SortModeDto;

    @IsInt()
    from: number;

    @IsString()
    @IsNotEmpty()
    @IsIn(['files', 'profile'])
    source: 'files'|'profile';
}