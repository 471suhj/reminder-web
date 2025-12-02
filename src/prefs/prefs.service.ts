import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { UserCommonDto } from 'src/user/user-common.dto';
import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

@Injectable()
export class PrefsService {

    constructor(private mysqlService: MysqlService){}

    private readonly logger = new Logger(PrefsService.name);

    async getUserCommon(userSer: number, pageSel: 'home'|'files'|'bookmarks'|'shared'|'friends'|'prefs'): Promise<UserCommonDto>{
        const retVal: UserCommonDto = new UserCommonDto();
        const pool: Pool = await this.mysqlService.getSQL();
        let result;
        try {
            [result] = await pool.execute<RowDataPacket[]>(
                'select name, side_bookmarks, side_shared from user where user_id=?', [userSer]);
            if (result.length <= 0){
                this.logger.error('the user cannot be found: serial=' + userSer);
                throw new InternalServerErrorException();
            }
        } catch (err) {
            if (!(err instanceof InternalServerErrorException)){
                this.logger.error('mysql error at prefs service getusercommon.');
                console.log(err);
            }
            throw new InternalServerErrorException();
        }
        retVal.username = String(result[0].name);

        retVal.sideItem = [['/home', pageSel === 'home' ? '' : 'Sel', '/graphics/home.png', '홈']];
        retVal.sideItem.push(['/files', pageSel === 'files' ? '' : 'Sel', '/graphics/files.png', '파일']);
        if(result[0].side_bookmarks === 'true')
            {retVal.sideItem.push(['/files/bookmarks', pageSel === 'bookmarks' ? '' : 'Sel', '/graphics/bookmarks.png', '즐겨찾기']);}
        if(result[0].side_shared === 'true')
            {retVal.sideItem.push(['/files/shared', pageSel === 'shared' ? '' : 'Sel', '/graphics/shared.png', '공유']);}
        retVal.sideItem.push(['/friends', pageSel === 'friends' ? '' : 'Sel', '/graphics/friends.png', '친구']);
        retVal.sideItem.push(['/prefs', pageSel === 'prefs' ? '' : 'Sel', '/graphics/prefs.png', '설정']);
        
        retVal.notificationCnt = 3;
        return retVal;
    }
}
