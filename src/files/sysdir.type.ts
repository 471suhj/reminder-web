import { BadRequestException } from "@nestjs/common";

export class SysdirType {
    val: 'files'|'bookmarks'|'recycle'|'inbox'|'shared'|'upload_tmp';
    static arr = ['files', 'bookmarks', 'recycle', 'inbox', 'shared', 'upload_tmp'];
    static translate(val: string){
        switch(val){
            case 'bookmarks':
                return '바로 가기';
            case 'recycle':
                return '휴지통';
            case 'shared':
                return '공유된 파일';
            case 'inbox':
                return '받은 파일';
            case 'upload_tmp':
                return 'upload_tmp';
            case 'files':
                return '파일';
            default:
                throw new BadRequestException();
            }
    }
}