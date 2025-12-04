import { Controller, Get, Render, Query, Param, BadRequestException, ParseIntPipe, ParseBoolPipe, ParseDatePipe, Post, Body, Put, Delete, Logger } from '@nestjs/common';
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
import { FileIdentReqDto } from './file-ident-req.dto';

@Controller('files')
export class FilesController {
    constructor(private mysqlService: MysqlService, private prefsService: PrefsService, private filesService: FilesService){}

    private readonly logger = new Logger(FilesController.name);

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
        if (body.action !== 'permdel'){throw new BadRequestException();}
        await this.mysqlService.doTransaction('files controller permdelete', async (conn)=>{
            let arr = body.files.map((val)=>val.id);
            await conn.execute<RowDataPacket[]>(
                `update recycle set to_delete='true' where user_serial=? and fie_serial in ?`, [userSer, arr]);
            while (arr.length > 0){
                await conn.execute<RowDataPacket[]>(
                    `update recycle set to_delete='true' where user_serial=? and file_parent in ? and del_type='recursive' `,
                    [userSer, arr]
                );
                let [result] = await conn.execute<RowDataPacket[]>(
                    `select file_serial from recycle where user_serial=? and file_parent in ? and type='dir' and del_type='recursive' `,
                    [userSer, arr]
                );
                arr = result.map((val)=>val.file_serial);
            }
            await conn.execute<RowDataPacket[]>(
                `delete from recycle where user_serial=? and to_delete='true'`, [userSer]);
        });
        return new FileDelResDto();
    }

    @Put('recycle') // unlike other places, shouldn't abort process when alreadyexists is set
    async restoreFile(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        let arr: FileIdentReqDto[], arrFail: FileIdentReqDto[], clash_toolong: boolean, namechange: boolean;
        if (body.action !== 'restore'){throw new BadRequestException();}
        await this.mysqlService.doTransaction('files controller put recycle', async (conn)=>{
            ({arr, arrFail, clash_toolong, namechange} = await this.filesService.restoreFiles(conn, userSer, body.files));
            
        })
        return {
            failed: arrFail!.map((val)=>{return {id: val.id, timestamp: val.timestamp.toISOString()};}),
            delarr: arr!.map((val)=>{return {id: val.id, timestamp: val.timestamp.toISOString()};}),
            failmessage: clash_toolong! ? '파일명에 중복 방지를 위해 "-2"를 붙이는 과정에서 파일명 한도를 초과하였습니다.' : '', 
            alreadyExists: namechange!
        };
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
    @Delete('manage') // do not delete system dirs
    async deleteFile(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        let retVal = new FileDelResDto();
        retVal.delarr = [];
        retVal.failed = [];
        await this.mysqlService.doTransaction('files controller delete manage', async (conn)=>{
            switch (body.action){
                case 'selected':
                    if (!body.timestamp || !body.from){throw new BadRequestException();}
                    if (await this.filesService.checkTimestamp(conn, userSer, body.from, body.timestamp, 'dir')){
                        retVal.expired = true;
                        return;
                    }
                    return await this.filesService.deleteFiles(conn, userSer, body.files, body.from);
                case 'restore':
                    throw new BadRequestException(); // handled in put(recycle)
                case 'permdel':
                    throw new BadRequestException(); // handled in delete(recycle)
                case 'bookmark':
                    break;
                case 'unshare':
                    break;
            }
        });
        return retVal;
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
        let retVal = new FileMoveResDto();
        retVal.addarr = [];
        retVal.delarr = [];
        retVal.failmessage = '';
        await this.mysqlService.doTransaction('files controller move', async (conn)=>{
            if (!body.timestamp){throw new BadRequestException();}
            if (!body.ignoreTimpstamp && await this.filesService.checkTimestamp(conn, userSer, body.from, body.timestamp, 'dir')){
                retVal.expired = true;
                return;
            }
            if (!await this.filesService.checkAccess(conn, userSer, body.to, 'dir', 'fileonly')){
                throw new BadRequestException();
            }
            // access control: from dir, to dir, and files
            // consider duplicating in the same folder
            const relDir = (body.from === body.to) ? [body.from] : [body.from, body.to];
            if (relDir.length <= 1 && body.action === 'move'){
                return;
            }
            const str1 = `select type, file_name from file where user_serial=? and parent_serial=? and file_serial in ? for update`;
            let [resName] = await conn.execute<RowDataPacket[]>({sql: str1, rowsAsArray: true}, [userSer, body.from, body.files]);
            // check if file with the same name already exists
            let [resDup] = await conn.execute<RowDataPacket[]>(
                `select file_serial, type, file_name, last_renamed as timestamp from file where user_serial=? and parent_serial=? and (type, file_name) in ? for update`,
                [userSer, body.to, resName]
            );
            if (!body.overwrite){
                // get file names
                if ((resDup.length > 0) && (relDir.length >= 2)){ // assumes rename for copying to the same dir
                    retVal.alreadyExists = true;
                    return;
                }
                body.overwrite = 'buttonrename';
            }
            let result: RowDataPacket[];
            let arrDup = resDup.map((val)=>val.file_serial);
            if (body.overwrite === 'buttonoverwrite'){
                [result] = await conn.execute<RowDataPacket[]>(
                    `select file_serial from file where user_serial=? and parent_serial=? and type<>'dir' and (type, file_name) in ? for update`,
                    [userSer, body.to, resName]
                );
                const { delarr, failed, failmessage } = await this.filesService.deleteFiles(conn, userSer, result.map((val)=>val.file_serial), body.to);
                if (failmessage){this.logger.error('file copy error: failed to delete some: ' + failmessage);}
                for (let i = 0; i < resName.length; i++){
                    if (resName[i].type === 'dir'){
                        retVal.failmessage += '폴더의 경우 덮어쓰기 실패로 "-2"가 추가된 상태로 복사/이동되었습니다. ';
                        break;
                    }
                }
                if (failed.length > 0){
                    retVal.failmessage += '일부 파일의 경우 덮어쓰기 실패로 "-2"가 추가된 상태로 복사/이동되었습니다. ';
                }
                for (let i = 0; i < delarr.length; i++){
                    let loc = arrDup.indexOf(delarr[i].id);
                    if (loc === -1){continue;}
                    arrDup.splice(loc, 1);
                    resDup.splice(loc, 1);
                }
            }
            let arrRenamed;
            let arrFail: { file_serial: number; file_name: string; type: string; }[] = [];
            if (body.overwrite === 'buttonrename' || body.overwrite === 'buttonoverwrite'){
                // 1: get the new name and move first.
                ({arrFail, arrRenamed} = await this.filesService.moveFiles_rename(conn, userSer, body.action === 'move', body.to, resDup as {file_serial: number, file_name: string, type: string, timestamp: Date}[]));
            }
            // includes: skipping method
            // 2: move others
            for (let i = 0; i < arrDup.length; i++){
                body.files.splice(body.files.indexOf(arrDup[i]), 1);
            }
            let resAdd;
            if (body.action === 'move'){
                await conn.execute<RowDataPacket[]>(`update file set parent_serial=? where user_serial=? and file_serial in ?`,
                    [body.to, userSer, body.files]
                );
            } else {
                await conn.execute<RowDataPacket[]>(`insert into file (user_serial, parent_serial, type, file_name)
                    select user_serial, ?, type, file_name from file where user_serial=? and file_serial in ?`,
                    [body.to, userSer, body.files]
                );
                [result] = await conn.execute<RowDataPacket[]>(
                    `select * from file where user_serial=? and file_serial in ? for share`,
                    [userSer, body.files.map((val)=>val.id)]
                );
                resAdd = result.map((val)=>{return{
                    link: val.type === 'dir' ? `/files?dirid=${val.file_serial}` : `/edit?id=${val.file_serial}`,
                    id: val.file_serial,
                    isFolder: val.type === 'dir',
                    text: val.file_name,
                    bookmarked: val.bookmarked === 'true',
                    shared: '',
                    date: val.last_modified.toISOString(),
                    ownerImg: '/images/user',
                    timestamp: val.last_renamed.toISOString()};});
            }
            retVal.failed = !!(arrFail);
            retVal.addarr = relDir.length === 1 ? resAdd! : [];
            retVal.delarr = body.action === 'copy' ? [] : body.files.map((val)=>{return {id: val.id, timestamp: val.timestamp.toISOString()};}).concat(arrRenamed);
        });
        // do not use here
        return retVal;
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
            let [result] = await conn.execute<RowDataPacket[]>(`select user_serial, parent_serial from file where user_serial=? and file_serial=?`, [userSer, dirid]);
            if (result.length <= 0 || result[0].user_serial !== userSer){throw new BadRequestException();}
            retVal.arr = [{name: '(최상위 폴더)', id: rootid}, {name: '(상위 폴더)', id: Number(result[0].parent_serial)}];
            [result] = await conn.execute<RowDataPacket[]>(
                `select file_name as name, file_serial as id from file where user_serial=? and parent_serial=? and type='dir' and issys='false'`, [userSer, dirid]);
            retVal.arr = retVal.arr.concat(result as FileListResDto['arr']);
            if (select === 'sepall'){
                [result] = await conn.execute<RowDataPacket[]>(
                    `select file_name as name, file_serial as id from file where user_serial=? and parent_serial=? and type<>'dir' and issys='false'`);
                retVal.arr2 = result as FileListResDto['arr2'];
            }
        });
        return retVal;
    }
}
