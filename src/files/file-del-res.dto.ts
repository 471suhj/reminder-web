import { FileIdentResDto } from "./file-ident-res.dto";

export class FileDelResDto {
    delarr: Array<FileIdentResDto> = [];
    failed: Array<FileIdentResDto> = [];
    failmessage?: string; // '', undefined both accepted
    alreadyExists?: boolean; // restoring only, rename with '-2' appended without rollback
    expired?: boolean; // file only
}