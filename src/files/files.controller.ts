import { Controller, Get, Render, Query, Param, BadRequestException, ParseIntPipe, ParseBoolPipe, ParseDatePipe, Post, Body, Put, Delete } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { User } from 'src/user/user.decorator';
import { FilesGetDto } from './files-get.dto';
import { PrefsService } from 'src/prefs/prefs.service';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { FilesService } from './files.service';
import { FilesMoreDto } from './files-more.dto';
import { SysdirType } from './sysdir.type';
import { FileUploadDto } from './file-upload.dto';
import { FileUpdateDto } from './file-update.dto';
import { FileDeleteDto } from './file-delete.dto';
import { FileShareDto } from './file-share.dto';
import { FileDelResDto } from './file-del-res.dto';
import { FileShareResDto } from './file-share-res.dto';
import { FilesArrDto } from './files-arr.dto';
import { FileMoveResDto } from './file-move-res.dto';
import { FileMoveDto } from './file-move.dto';
import { FileListResDto } from './file-list-res.dto';

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
    @Render('files/bookmarks')
    async getBookmarks(@User(ParseIntPipe) userSer: number): Promise<FilesGetDto> {
        return await this.filesService.renderSharedPage(userSer, 'bookmarks');
    }

    @Get('shared')
    @Render('files/shared')
    async getShared(@User(ParseIntPipe) userSer: number): Promise<FilesGetDto>{
        return await this.filesService.renderSharedPage(userSer, 'shared');
    }

    @Get('recycle')
    @Render('files/recycle')
    async getRecycle(@User(ParseIntPipe) userSer: number): Promise<FilesGetDto>{
        return await this.filesService.renderSharedPage(userSer, 'recycle');
    }

    @Delete('recycle')
    async delPermanent(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        return new FileDelResDto();
    }

    @Put('recycle')
    async restoreFile(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        return new FileDelResDto();
    }

    // upload rmb files
    @Post('manage')
    async uploadFile(@User(ParseIntPipe) userSer: number, @Body() body: FileUploadDto){

    }

    // rename, create directory, create files from files, or enable bookmark
    @Put('manage') // 'before's in filesarrdto are not ignored, success object is for rename only.
    async manageFile(@User(ParseIntPipe) userSer: number, @Body() body: FileUpdateDto): Promise<FilesArrDto|{success: boolean, failmessage?: string}>{
        return {success: true};
    }

    // delete from files, bookmarks and shared
    @Delete('bookmark')
    @Delete('manage') // do not delete system dirs
    async deleteFile(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        return new FileDelResDto();
    }

    @Put('bookmark')
    async setBookmark(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        return new FileDelResDto();
    }

    // sharing from files or profile
    @Put('share')
    async shareFile(@User(ParseIntPipe) userSer: number, @Body() body: FileShareDto): Promise<FileShareResDto>{
        return new FileShareResDto();
    }

    // copy and move from files
    @Put('move')
    async copyMoveFile(@User(ParseIntPipe) userSer: number, @Body() body: FileMoveDto): Promise<FileMoveResDto>{
        await this.mysqlService.doTransaction('files controller move', async (conn)=>{
            // ignore timestamp
            // access control
            let [result] = await conn.execute<RowDataPacket[]>(
                `select file_serial from file where user_serial=? and file_serial=?  and type='dir' for share`,
                [userSer, body.from]
            );
            if (result.length <= 0){throw new BadRequestException();}
            if (!body.overwrite){
                let subq = `select file_name from file where user_serial=? and parent_serial=? and file_serial in ? for update`;
                await conn.execute<RowDataPacket[]>(
                    `select file_serial from file where user_serial=? and parent_serial=? and file_name in (${subq}) for update`,
                    [userSer, body.to, []]
                );
            } else if (body.overwrite === 'buttonoverwrite'){
                //
            } else if (body.overwrite === 'buttonrename'){
                //
            } else { // skip
                //
            }
            // don't forget to say for share
            // idempotent operation
        });
        return new FileMoveResDto();
    }

    // get list for dialogs
    @Get('list')
    async getFileList(
        @User(ParseIntPipe) userSer: number,
        @Query('select') select: 'folders'|'sepall',
        @Query('dirid', new ParseIntPipe({optional: true})) dirid?: number
    ): Promise<FileListResDto>{
        let retVal = new FileListResDto();
        let rootid = await this.filesService.getUserRoot(userSer, 'files');
        if (dirid === undefined){
            dirid = rootid;
        }
        await this.mysqlService.doQuery('files controller list', async (conn)=>{
            let [result] = await conn.execute<RowDataPacket[]>(`select parent_serial from file where user_serial=? and file_serial=?`, [userSer, dirid]);
            if (result.length <= 0){throw new BadRequestException();}
            retVal.arr = [{name: '(최상위 폴더)', id: rootid}, {name: '(상위 폴더)', id: Number(result[0].parent_serial)}];
            [result] = await conn.execute<RowDataPacket[]>(
                `select file_name as name, file_serial as id from file where user_serial=? and parent_serial=? and type='dir'`, [userSer, dirid]);
            retVal.arr = retVal.arr.concat(result as FileListResDto['arr']);
            if (select === 'sepall'){
                [result] = await conn.execute<RowDataPacket[]>(
                    `select file_name as name, file_serial as id from file where user_serial=? and parent_serial=? and type<>'dir'`);
                retVal.arr2 = result as FileListResDto['arr2'];
            }
        });
        return retVal;
    }
}
