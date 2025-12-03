export class FileDelResDto {
    arr: Array<number>;
    failed: Array<number>;
    failmessage?: string; // '', undefined both accepted
    alreadyExists?: boolean; // restoring only, rename with '-2' appended without rollback
}