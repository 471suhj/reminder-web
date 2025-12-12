import { IsInt } from "class-validator";

export class InboxSaveDto {
    @IsInt()
    id: number;
}