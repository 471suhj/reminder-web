import { IsDate, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Length, ValidateNested } from "class-validator";
import { SortModeDto } from "./sort-mode.dto";
import { Type } from "class-transformer";

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
    @IsInt()
    file?: number; // for rename only

    @IsString()
    @IsNotEmpty()
    @Length(1, 40)
    name: string;

    @Type(()=>Date)
    @IsDate()
    timestamp: Date;
}