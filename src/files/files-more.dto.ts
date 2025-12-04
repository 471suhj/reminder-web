import { FilesArrDto } from "./files-arr.dto";

export class FilesMoreDto { // before is ignored
    addarr: FilesArrDto['arr'];
    loadMore: boolean;
    needRefresh: boolean;
    needReload: boolean; // true when change to timestamp
}