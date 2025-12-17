import { FilesArrDto } from "./files-arr.dto";

export class FilesMoreDto { // before is ignored
    addarr: FilesArrDto['arr'] = [];
    loadMore: boolean = true;
    needRefresh: boolean;
    needReload: boolean;
}