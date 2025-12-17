import { IsInt, IsString } from "class-validator";

export class InboxSaveDto {
    @IsString()
    id: string;
}