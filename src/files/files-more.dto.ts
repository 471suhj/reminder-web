import { FilesArrDto } from "./files-arr.dto";

export class FilesMoreDto  extends FilesArrDto{ // before is ignored
    loadMore: boolean;
    needRefresh: boolean;
    needReload: boolean; // true when change to timestamp
}