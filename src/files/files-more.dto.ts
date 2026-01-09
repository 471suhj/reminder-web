import { FilesArrResDto } from "./files-arr-res.dto";

export class FilesMoreDto { // before is ignored
    addarr: FilesArrResDto['arr'] = [];
    loadMore: boolean = true;
    needRefresh: boolean = false;
    needReload: boolean = false;
}