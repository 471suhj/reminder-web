import { IsDate, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Length, ValidateNested } from "class-validator";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";
import { FileIdentReqDto } from "./file-ident-req.dto";

export class FileUpdateDto { // createdir: update current folder to have more child directories

    @IsString()
    @IsNotEmpty()
    @IsIn(['rename', 'createDir', 'createFile'])
    action: 'rename'|'createDir'|'createFile';

    @IsObject()
    @ValidateNested()
    @Type(()=>SortModeDto)
    sort: SortModeDto;

    @IsInt()
    id: number; // id of directory

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(()=>FileIdentReqDto)
    file?: FileIdentReqDto; // for rename only

    @IsString()
    @IsNotEmpty()
    @Length(1, 40)
    name: string;

    @IsDate()
    @Type(()=>Date)
    timestamp: Date;
}