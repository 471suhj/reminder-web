import { Controller, Get, Render, Query, Param, BadRequestException, ParseIntPipe, ParseBoolPipe, ParseDatePipe } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { User } from 'src/user/user.decorator';
import { FilesGetDto } from './files-get.dto';
import { PrefsService } from 'src/prefs/prefs.service';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { FilesService } from './files.service';
import { FilesMoreDto } from './files-more.dto';
import { SysdirType } from './sysdir.type';

@Controller('files')
export class FilesController {
    constructor(private mysqlService: MysqlService, private prefsService: PrefsService, private filesService: FilesService){}

    @Get()
    @Render('files/files')
    async getFiles(@User() userSer: number, @Query('dirid', new ParseIntPipe({optional: true})) dirid: number|undefined): Promise<FilesGetDto> {
        if (dirid === undefined){
            dirid = await this.filesService.getUserRoot(userSer, 'files');
        }
        return await this.filesService.renderFilesPage(userSer, dirid);
    }

    @Get('inbox')
    @Render('files/files')
    async getInbox(@User() userSer: number): Promise<FilesGetDto> {
        return await this.filesService.renderFilesPage(userSer, await this.filesService.getUserRoot(userSer, 'inbox'))
    }

    @Get('loadmore') // files, shared, bookmarks, inbox
    async getFileMore(
        @User(ParseIntPipe) userSer: number,
        @Query('startafter', ParseIntPipe) startAfter: number, // 0 for initial or others
        @Query('dirid', ParseIntPipe) dirId: number, 
        @Query('sort') sort: 'colName'|'colDate',
        @Query('lastrenamed', ParseDatePipe) lastrenamed: Date,
        @Query('sortincr', ParseBoolPipe) sortincr: boolean
    ): Promise<FilesMoreDto>{

        let sortCta: string;
        let needRefresh: boolean = false;
        let loadMore: boolean = true;
        let retArr: FilesMoreDto['arr'] = [];
        sortCta = this.filesService.translateColumn(sort, 'files');
        await this.mysqlService.doTransaction('files loadmore', async function(conn){
            let result, result1, result2: RowDataPacket[];
            let sortDir = sortincr ? 'asc' : 'desc';
            const compOp = sortincr ? '>' : '<';
            const compOp2 = sortincr ? '<' : '>';
            if (startAfter > 0){
                [result] = await conn.execute<RowDataPacket[]>(
                    `select last_renamed, type, ${sortCta} from file where user_serial=? and file_serial=? for share`, [userSer, startAfter]);
                if (result.length <= 0){
                    needRefresh = true;
                    return;
                }
                if (+(result[0].last_renamed) !== +lastrenamed){
                    needRefresh = true;
                    return;
                }
                [result1] = await conn.execute<RowDataPacket[]>(
                    `select * from file
                    where user_serial=? and parent_serial=? and type ${compOp}= ? and ${sortCta} ${compOp} ?
                    order by type ${sortDir}, ${sortCta} ${sortDir} limit 21 for share`,
                    [userSer, dirId, result[0].type, result[0][sortCta]]
                );
                [result2] = await conn.execute<RowDataPacket[]>(
                    `select file_serial, name
                    from file inner join shared_def using (file_serial) inner join user on user_serial_to=user.user_serial
                    where user_serial=? and parent_serial=? and
                    type ${compOp}= ? and type ${compOp2}= ? and file.${sortCta} ${compOp} ? and file.${sortCta} ${compOp2}= ?
                    order by type ${sortDir}, file.${sortCta} ${sortDir} for share`,
                    [userSer, dirId, result[0].type, result.slice(-1)[0].type, result[0][sortCta], result.slice(-1)[0][sortCta]]
                );
            } else {
                [result1] = await conn.execute<RowDataPacket[]>(
                    `select * from file
                    where user_serial=? and parent_serial=?
                    order by type ${sortDir}, ? ${sortDir} limit 21 for share`,
                    [userSer, dirId, sortCta]
                );
                [result2] = await conn.execute<RowDataPacket[]>(
                    `select file_serial, name
                    from file inner join shared_def using (file_serial) inner join user on user_serial_to=user.user_serial
                    where user_serial=? and parent_serial=? and type ${compOp2}= ? and file.${sortCta} ${compOp2}= ?
                    order by type ${sortDir}, file.${sortCta} ${sortDir} for share`,
                    [userSer, dirId, result.slice(-1)[0].type, result.slice(-1)[0][sortCta]]
                );

            }
            loadMore = (result1.length > 20);
            let itmCnt = Math.min(result1.length, 20);
            let j = 0;
            for (let i = 0; i < itmCnt; i++){
                const itm = result1[i];
                let sharedstr = '';
                const itmName = (itm.issys === 'true') ? SysdirType.translate(itm.file_name) : itm.file_name;
                while (j < result2.length && result2[j].file_serial === itm.file_serial){
                    sharedstr += String(result2[j].name);
                    sharedstr += ', ';
                    j++;
                }
                sharedstr = sharedstr.slice(0, -2);
                retArr.push({
                    link: (itm.issys === 'true' ? `/files/${itm.file_name}` 
                        : (itm.type === 'dir' ? `/files?dirid=${itm.file_id}` : `/edit?id=${itm.file_id}`)),
                    id: itm.file_id,
                    isFolder: itm.type === 'dir',
                    text: itmName,
                    bookmarked: itm.bookmarked === 'true',
                    shared: sharedstr,
                    date: (itm.last_modified as Date).toISOString(),
                    ownerImg: '/images/user'})
            }
        });
        return {loadMore, arr: retArr, needRefresh};
    }
    
    @Get('bookmarks')
    @Render('files/shared')
    async getBookmarks(@User(ParseIntPipe) userSer: number): Promise<FilesGetDto> {
        return await this.filesService.renderSharedPage(userSer, 'bookmarks');
    }

    @Get('shared')
    @Render('files/shared')
    async getShared(@User(ParseIntPipe) userSer: number): Promise<FilesGetDto>{
        return await this.filesService.renderSharedPage(userSer, 'shared');
    }


}
