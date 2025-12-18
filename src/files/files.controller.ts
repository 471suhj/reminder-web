import { Controller, Get, Render, Query, Param, BadRequestException, ParseIntPipe, ParseBoolPipe, ParseDatePipe, Post, Body, Put, Delete, Logger, UseInterceptors, UploadedFile, UploadedFiles, InternalServerErrorException, Redirect, Req } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { User } from 'src/user/user.decorator';
import { FilesGetDto } from './files-get.dto';
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { FilesService } from './files.service';
import { FilesMoreDto } from './files-more.dto';
import { FileUpdateDto } from './file-update.dto';
import { FileDeleteDto } from './file-delete.dto';
import { FileShareDto } from './file-share.dto';
import { FileDelResDto } from './file-del-res.dto';
import { FileShareResDto } from './file-share-res.dto';
import { FileMoveResDto } from './file-move-res.dto';
import { FileMoveDto } from './file-move.dto';
import { FileListResDto } from './file-list-res.dto';
import { FileIdentReqDto } from './file-ident-req.dto';
import { FriendMoreDto } from './friend-more.dto';
import { InboxSaveDto } from './inbox-save.dto';
import { MongoService } from 'src/mongo/mongo.service';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import type { Request } from 'express';
import busboy from 'busboy';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

@Controller('files')
export class FilesController {
    constructor(
        private readonly mysqlService: MysqlService, 
        private readonly filesService: FilesService,
        private readonly mongoService: MongoService,
    ){}

    private readonly logger = new Logger(FilesController.name);

    @Get()
    @Render('files/files')
    async getFiles(@User() userSer: number, @Query('dirid', new ParseIntPipe({optional: true})) dirid: number|undefined): Promise<FilesGetDto> {
        if (dirid === undefined){
            dirid = await this.filesService.getUserRoot(userSer, 'files');
        }
        return await this.filesService.renderFilesPage(userSer, dirid);
    }

    @Get('files')
    @Redirect('/files')
    getFilesFiles(){}

    @Get('inbox')
    @Render('files/files')
    async getInbox(@User() userSer: number): Promise<FilesGetDto> {
        return await this.filesService.renderFilesPage(userSer, await this.filesService.getUserRoot(userSer, 'inbox'))
    }

    @Get('loadmore') // files, shared, bookmarks, inbox, recycle
    async getLoadmore(
        @User() userSer: number,
        @Query('startafter', ParseIntPipe) startAfter: number, // 0 for initial or others
        @Query('startaftertimestamp', new ParseDatePipe()) timestamp: Date, // 0 for initial or others
        @Query('dirid', ParseIntPipe) dirId: number, 
        @Query('sort') sort: string,
        @Query('lastrenamed', new ParseDatePipe()) lastrenamed: Date,
        @Query('sortincr', ParseBoolPipe) sortincr: boolean,
        @Query('mode') mode: string // files, profile, shared, friends, bookmarks, recycle
    ): Promise<FilesMoreDto|FriendMoreDto>{
        switch (mode){
            case 'files':
                return await this.filesService.loadFileMore(userSer, dirId, lastrenamed, startAfter, timestamp, {criteria: sort, incr: sortincr});
            case 'profile':
                return await this.filesService.loadSharedMore(userSer, startAfter, timestamp, {criteria: sort, incr: sortincr}, dirId);
            case 'shared':
                return await this.filesService.loadSharedMore(userSer, startAfter, timestamp, {criteria: sort, incr: sortincr});
            case 'friends':
                return await this.filesService.loadFriendMore(userSer, startAfter, {criteria: sort, incr: sortincr});
            case 'bookmarks':
                return await this.filesService.loadBookmarkMore(userSer, startAfter, timestamp, {criteria: sort, incr: sortincr});
            case 'recycle':
                return await this.filesService.loadRecycleMore(userSer, startAfter, timestamp, {criteria: sort, incr: sortincr});
            default:
                throw new BadRequestException();
        }
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
    async delRecycle(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        if (body.files.length <= 0){
            return {delarr: [], failed: []};
        }
        await this.filesService.resolveLoadmore(userSer, body.files, body.last.id, body.last.timestamp,
            body.sort, 'recycle');
        if (body.action !== 'permdel'){throw new BadRequestException();}
        let resDelArr: RowDataPacket[] = [];
        let resDelFiles: RowDataPacket[] = [];
        await this.mysqlService.doTransaction('files controller permdelete', async (conn)=>{
            let arr = body.files.map((val)=>val.id);
            await conn.query(
                `update recycle set to_delete='true' where user_serial=? and file_serial in (?)`, [userSer, arr]);
            while (arr.length > 0){
                await conn.query(
                    `update recycle set to_delete='true' where user_serial=? and parent_serial in (?) and del_type='recursive' `,
                    [userSer, arr]
                );
                let [result] = await conn.query<RowDataPacket[]>(
                    `select file_serial from recycle where user_serial=? and parent_serial in (?) and type='dir' and del_type='recursive' `,
                    [userSer, arr]
                );
                arr = result.map((val)=>val.file_serial);
            }
            [resDelArr] = await conn.execute<RowDataPacket[]>(
                `select file_serial, last_renamed from recycle where user_serial=? and to_delete='true' and del_type='direct'`, [userSer]
            );
            [resDelFiles] = await conn.execute<RowDataPacket[]>(
                `select file_serial from recycle where user_serial=? and to_delete='true' and type='file'`, [userSer]
            );
            await conn.execute<RowDataPacket[]>(
                `delete from recycle where user_serial=? and to_delete='true'`, [userSer]);
        });
        let retVal = new FileDelResDto();
        retVal.delarr = resDelArr.map(val=>{return {id: val.file_serial, timestamp: val.last_renamed.toISOString()};});
        const limit = Math.ceil(resDelFiles.length / 80);
        const arrMongo = resDelFiles.map(val=>val.file_serial);
        for (let i = 0; i < limit; i++){
            await this.mongoService.getDb().collection('file_data').deleteMany({serial: {$in: arrMongo.slice(80 * i, 80 * (i + 1))}});
        }
        for (const itm of retVal.delarr.map(val=>val.id)){
            await fs.rm(join(__dirname, `../../filesys/${itm}`), {force: true, recursive: true});
        }
        return retVal;
    }

    @Put('recycle') // unlike other places, shouldn't abort process when alreadyexists is set
    async putRecycle(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        await this.filesService.resolveLoadmore(userSer, body.files, body.last.id, body.last.timestamp,
            body.sort, 'recycle');
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

    // rename, create directory, create files from files
    @Put('manage') // 'before's in filesarrdto are not ignored.
    async putManage(@User(ParseIntPipe) userSer: number, @Body() body: FileUpdateDto): Promise<FileMoveResDto>{
        // share: file only! no folders!!
        let retVal: FileMoveResDto;
        if (body.action === 'createDir'){
            await this.mysqlService.doTransaction('files controller put manage createdir', async (conn)=>{
                retVal = await this.filesService.createDir(conn, userSer, body.id, body.name, body.sort);
            });
        } else if (body.action === 'createFile'){
            await this.mysqlService.doTransaction('files controller put manage createdir', async (conn)=>{
                retVal = await this.filesService.createFile(conn, userSer, body.id, body.name, body.sort);
            });
        } else if (body.action === 'rename'){
            if (body.file === undefined){throw new BadRequestException();}
            await this.mysqlService.doTransaction('files controller put manage rename', async (conn)=>{
                retVal = await this.filesService.renameFile(conn, userSer, body.id, body.file!, body.name);
            });
        } else {throw new BadRequestException();}
        try{
            await this.filesService.resolveBefore(await this.mysqlService.getSQL(), userSer, body.sort, retVal!.addarr, 'files', body.id);
        } catch (err) {
            retVal!.addarr.forEach(val=>{val.before = {id:-1, timestamp: ''};})
            console.log(err);
        }
        return retVal!;
    }

    @Post('manage')
    async postManage(@User() userSer: number, @Req() req: Request){
        let reqOrigin = req.headers['sec-fetch-site'];
        if (reqOrigin !== 'same-origin' && reqOrigin !== 'same-site'){
            throw new BadRequestException();
        }

        let retVal = new FileMoveResDto();
        const dir = await this.filesService.getUserRoot(userSer, 'upload_tmp');
        const root = await this.filesService.getUserRoot(userSer, 'files');
        const subt = '(user_serial, parent_serial, type, file_name)';
        let closeReturned = false;
        let nullReturned = false;
        
        const bb = busboy({headers: req.headers, fileHwm: 512, limits: {files: 100}, defParamCharset: 'utf8'});
        // important!: make sure that all exceptions are handled internally and not thrown
        bb.on('file', async (name: string, fstream: Readable, info: busboy.FileInfo)=>{
            let res: RowDataPacket[] = [];
            try{
                await this.mysqlService.doTransaction('files controller post manage1', async conn=>{
                    [res] = await conn.execute<RowDataPacket[]>(
                        `select file_serial from file where user_serial=? and parent_serial=? for update`, [userSer, dir]
                    );
                    for (const itm of res){
                        try{
                            await fs.rm(join(__dirname, `../../filesys/${itm.file_serial}`), {force: true, recursive: true});
                        } catch (err) {}
                    }
                    
                    await conn.execute(`delete from file where user_serial=? and parent_serial=?`, [userSer, dir]);
                    await conn.execute(`insert into file ${subt} value (?, ?, 'file', ?)`,
                        [userSer, dir, info.filename.length > 4 ? info.filename.slice(0, -4) : info.filename]
                    );
                    [res] = await conn.execute<RowDataPacket[]>(
                        `select file_serial, last_renamed from file where user_serial=? and parent_serial=?`,
                        [userSer, dir]
                    );
                });
                await this.filesService.uploadMongo(res[0].file_serial, fstream, userSer);
                // one transaction
                let {failed} = await this.putMove(userSer, {action: 'move', files: [{id: res[0].file_serial, timestamp: res[0].last_renamed}],
                    from: dir, to: root, last: {id: -1, timestamp: new Date()}, sort: {criteria: 'colName', incr: true}, ignoreTimestamp: true, timestamp: new Date(), overwrite: 'buttonrename'});
                // another transaction
                await this.mysqlService.doTransaction('files controller post manage2', async conn=>{
                    if (failed.length <= 0){
                        let [res2] = await conn.execute<RowDataPacket[]>(`select * from file where file_serial=?`, [res[0].file_serial]);
                        retVal.addarr.push({date: res2[0].last_modified, id: res2[0].file_serial, isFolder: false, text: res2[0].file_name,
                            timestamp: res2[0].last_renamed, bookmarked: false, before: {id: -1, timestamp: '2000-01-01T00:00:00.000Z'}, link: '/edit?id=' + res2[0].file_serial, shared: ''
                        }); // sort is not transmitted, and uploaded files should be visible
                        // but shouldn't be relied upon when refreshing, so dummy timestamp is supplied
                    } else {
                        retVal.failed.push([0, info.filename]);
                        await this.mongoService.getDb().collection('file_data').deleteOne({serial: res[0].file_serial});
                    }
                });
            } catch (err) {
                retVal.failed.push([0, info.filename]);
                fstream.destroy();
                return;
            } finally {
                nullReturned = true;
            }
        });
        bb.on('close', ()=>{
            closeReturned = true;
        });
        await pipeline(req, bb);
        while ((!closeReturned) || (!nullReturned)){
            await new Promise(resolve=>setImmediate(resolve));
        }
        return retVal;
    }

    // delete from files, bookmarks and shared
    @Delete(['manage', 'bookmark']) // do not delete system dirs
    async delManage(@User() userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        let strMode: 'files' | 'bookmarks' | 'recycle' | 'shared';
        switch (body.action){
            case 'permdel': case 'restore': strMode = 'recycle'; break;
            case 'selected': strMode = 'files'; break;
            case 'unshare': strMode = 'shared'; break;
            case 'bookmark': strMode = 'bookmarks'; break;
            default: throw new BadRequestException();
        }
        await this.filesService.resolveLoadmore(userSer, body.files, body.last.id, body.last.timestamp,
            body.sort, strMode, body.from, body.timestamp);
        let retVal = new FileDelResDto();
        await this.mysqlService.doTransaction('files controller delete manage', async (conn, rb)=>{
            switch (body.action){
                case 'selected':
                    if (!body.timestamp || !body.from){throw new BadRequestException();}
                    if (!body.ignoreTimestamp && !(await this.filesService.checkTimestamp(conn, userSer, body.from, body.timestamp, 'dir'))){
                        retVal.expired = true;
                        rb.rback = true;
                        return;
                    }
                    retVal = await this.filesService.deleteFiles(conn, userSer, body.files, body.from, rb);
                    return;
                case 'restore':
                    throw new BadRequestException(); // handled in put(recycle)
                case 'permdel':
                    throw new BadRequestException(); // handled in delete(recycle)
                case 'bookmark':
                    retVal = await this.filesService.removeBookmark(conn, userSer, body.files);
                    return;
                case 'unshare':
                    retVal = await this.filesService.removeShare(conn, userSer, body.files);
                    return;
            }
        });
        return retVal;
    }

    @Put('bookmark')
    async putBookmark(@User(ParseIntPipe) userSer: number, @Body() body: FileDeleteDto): Promise<FileDelResDto>{
        if (body.action !== 'bookmark'){throw new BadRequestException();}
        let retVal: FileDelResDto;
        await this.mysqlService.doTransaction('files controller put bookmark', async (conn)=>{
            retVal = await this.filesService.addBookmark(conn, userSer, body.files)
        });
        return retVal!;
    }

    // sharing from files or profile
    // addarr is prepared with the assumption that the window is profile.
    @Put('share')
    async putShare(@User(ParseIntPipe) userSer: number, @Body() body: FileShareDto): Promise<FileShareResDto>{
        if (body.friends.length <= 0){
            return {addarr: [], failed: []};
        }
        await this.filesService.resolveLoadmore(userSer, body.files, body.last.id, body.last.timestamp,
            body.sort, body.source === 'profile' ? 'files' : 'shared', body.from, body.timestamp);
        let retVal: FileShareResDto;
        await this.mysqlService.doTransaction('files controller put share', async (conn, rb)=>{
            // verify that they are friends
            let fverbose: [number, Date][] = body.files.map(val=>[val.id, val.timestamp]);
            let [result] = await conn.query<RowDataPacket[]>(
                `select user_serial_from from friend_mono where user_serial_to=? and user_serial_from in (?) for share`,
                [userSer, body.friends]
            );
            if (result.length < body.friends.length){throw new BadRequestException();}
            // verify that the files are valid
            [result] = await conn.query<RowDataPacket[]>(
                `select file_serial from file where user_serial=? and (file_serial, last_renamed) in (?) for share`, [userSer, fverbose]
            );
            let [result2] = await conn.query<RowDataPacket[]>(
                `select file_serial from shared_def where user_serial_to=? and file_serial in (?) for share`, [userSer, fverbose.map(val=>val[0])]
            );
            if (result.length + result2.length < body.files.length){
                rb.rback = true;
                retVal = new FileShareResDto();
                retVal.addarr = [];
                retVal.failed = body.files.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
                retVal.failreason = '현재 이름이 바뀌었거나 사용자가 접근할 수 없는 파일을 공유하고자 하였습니다. 파일 목록을 새로 고침한 후 다시 시도해 주시기 바랍니다.';
                return;
            }
            retVal = await this.filesService.addShare(conn, userSer, body.files, body.friends, body.mode);
        });
        if (body.sort !== undefined){
            retVal!.addarr = await this.filesService.resolveBefore(await this.mysqlService.getSQL(), userSer, body.sort, retVal!.addarr, 'profile', undefined, body.friends[0]);
        }
        return retVal!;
    }

    // copy and move from files
    @Put('move') // copy_origin eventually marks only copied 'files'
    async putMove(@User(ParseIntPipe) userSer: number, @Body() body: FileMoveDto): Promise<FileMoveResDto>{
        await this.filesService.resolveLoadmore(userSer, body.files, body.last.id, body.last.timestamp,
            body.sort, 'files', body.from, body.timestamp);
        let retVal = new FileMoveResDto();
        retVal.failmessage = '';
        let resAddedFiles: RowDataPacket[] = [];
        await this.mysqlService.doTransaction('files controller move', async (conn, rb)=>{
            if (!body.timestamp){throw new BadRequestException();}
            if (!body.ignoreTimestamp && !(await this.filesService.checkTimestamp(conn, userSer, body.from, body.timestamp, 'dir'))){
                rb.rback = true;
                retVal.expired = true;
                return;
            }
            if (!await this.filesService.checkAccess(conn, userSer, body.to, 'dir', 'fileonly')){
                throw new BadRequestException();
            }
            if (body.action === 'move'){
                const arrFiles = body.files.map(val=>val.id);
                if ((await this.filesService.getDirInfo(conn, userSer, body.to)).arrParentId.some(val=>arrFiles.includes(val))){
                    retVal.failed = body.files.map(val=>[val.id, val.timestamp]);
                    retVal.failmessage = '이동하려는 경로가 선택된 폴더이거나 그 하위 폴더입니다.';
                    return;
                }
            }
            // access control: from dir, to dir, and files
            // consider duplicating in the same folder
            const relDir = (body.from === body.to) ? [body.from] : [body.from, body.to];
            if (relDir.length <= 1 && body.action === 'move'){
                rb.rback = true;
                return;
            }
            // check the validity of files and get the (type,name)s.
            let {retArr: arrSafe, arrFail, resName} = await this.filesService.moveFiles_validateFiles(conn, userSer, body.from, body.files.map(val=>[val.id, val.timestamp]));            
            
            let resDup: RowDataPacket[];
            if (resName.length > 0){
                // get the list of files with the same name in the destination
                [resDup] = await conn.query<RowDataPacket[]>(
                    {sql: `select type, file_name from file where user_serial=? and parent_serial=? and (type, file_name) in (?) for update`, rowsAsArray: true},
                    [userSer, body.to, resName]
                );
            } else {
                resDup = [];
            }
            if (resDup.length > 0){
                [resDup] = await conn.query<RowDataPacket[]>(
                    `select file_serial, type, file_name, last_renamed as timestamp from file where user_serial=? and parent_serial=? and (type, file_name) in (?) for update`,
                    [userSer, body.from, resDup]
                );
            } else {
                resDup = [];
            }
            // requset overwrite mode if needed
            if (!body.overwrite){
                if ((resDup.length > 0) && (relDir.length >= 2)){ // assumes rename for copying to the same dir
                    retVal.alreadyExists = true;
                    rb.rback = true;
                    return;
                }
                body.overwrite = 'buttonrename';
            }
            await conn.execute(`update file set copy_origin=0 where user_serial=? and copy_origin<>0`, [userSer]);
            let result: RowDataPacket[];
            let arrDup = resDup.map((val)=>val.file_serial);
            // delete items to overwrite
            if (body.overwrite === 'buttonoverwrite'){
                // get original items to overwrite
                if (resName.length > 0){
                    [result] = await conn.query<RowDataPacket[]>(
                        `select file_serial, last_renamed from file where user_serial=? and parent_serial=? and type='file' and (type, file_name) in (?) for update`,
                        [userSer, body.to, resName]
                    );
                } else {
                    result = [];
                }
                // actually delete the items to overwrite
                const { delarr, failed, failmessage } = await this.filesService.deleteFiles(conn, userSer, result.map((val)=>{return {id: val.file_serial, timestamp: val.last_renamed}}), body.to, 'force');
                if (failmessage){this.logger.error('file copy error: failed to delete some: ' + failmessage);}
                for (let i = 0; i < resName.length; i++){
                    if (resName[i][0] === 'dir'){
                        retVal.failmessage += '폴더의 경우 덮어쓰기 실패로 "-2"가 추가된 상태로 복사/이동되었습니다. ';
                        break;
                    }
                }
                if (failed.length > 0){
                    retVal.failmessage += '일부 파일의 경우 덮어쓰기 실패로 "-2"가 추가된 상태로 복사/이동되었습니다. ';
                }
                // update arrDup to hold only items with name collisions
                for (let i = 0; i < delarr.length; i++){
                    let loc = arrDup.indexOf(delarr[i].id);
                    if (loc === -1){continue;}
                    arrDup.splice(loc, 1);
                    resDup.splice(loc, 1);
                }
            }
            // includes: skipping method
            // step1: move ordinary files first. don't forget to change last_renamed
            // arrSafe represents items without name collisions
            for (let i = 0; i < arrDup.length; i++){
                arrSafe.delete(arrDup[i]);
            }
            if (body.action === 'move'){
                if (arrSafe.size > 0){
                    await conn.query(`update file set parent_serial=?, last_renamed=current_timestamp where user_serial=? and file_serial in (?)`,
                        [body.to, userSer, Array.from(arrSafe, val=>val[0])]
                    );
                }
                retVal.delarr = Array.from(arrSafe, val=>{return {id: val[0], timestamp: val[1].toISOString()};});
            } else { // copy
                if (arrSafe.size > 0){
                    // duplication to the same dir cannot occur here: all duplications are handled in renamed file operations
                    await conn.query(`insert into file (user_serial, parent_serial, type, file_name, mark, copy_origin)
                        select ?, ?, type, file_name, 'true', file_serial from file where user_serial=? and file_serial in (?)`,
                        [userSer, body.to, userSer, Array.from(arrSafe, val=>val[0])]
                    );
                }
            }
            // step2: get the new name and then move/copy after step1, to prevent name collisions with files from step1.
            // don't forget to change last_renamed
            // deal with both move and copy
            // also deals with duplications within a dir.
            // excluding skip mode
            if (body.overwrite === 'buttonrename' || body.overwrite === 'buttonoverwrite'){
                let {arrFail: arrFail2, addarr, delarr} = await this.filesService.moveFiles_rename(conn, userSer, body.action === 'move', body.from, body.to, resDup as {file_serial: number, file_name: string, type: string, timestamp: Date}[]);
                arrFail = arrFail.concat(arrFail2);
                retVal.addarr = relDir.length === 1 ? addarr : [];
                retVal.delarr = body.action === 'move' ? retVal.delarr.concat(delarr) : [];
            }
            retVal.failed = arrFail.map(val=>[val[0], val[1].toISOString()]);
            // step3: copy recursively
            await this.filesService.moveFiles_copyRecurse(conn, userSer);

            [resAddedFiles] = await conn.execute<RowDataPacket[]>(
                `select file_serial, copy_origin from file where user_serial=? and copy_origin<>0 for share`, [userSer]
            );
        });
        // do not use here
        await this.filesService.copyMongo(resAddedFiles.map(val=>{return {id: val.file_serial, origin: val.copy_origin};}));
        retVal.addarr = await this.filesService.resolveBefore(await this.mysqlService.getSQL(), userSer, body.sort, retVal.addarr, 'files', body.from);
        return retVal;
    }

    @Put('inbox-save')
    async putInbox(@User(ParseIntPipe) userSer: number, @Body() body: InboxSaveDto): Promise<{success: boolean, failmessage?: string}>{
        let retVal = {success: true};
        await this.mysqlService.doTransaction('files controller put inbox-save', async conn=>{
            let ret = await this.filesService.restoreFiles(conn, userSer, Number(body.id));
            if (ret.arrFail.length > 0){
                retVal.success = false;
                return;
            } else {
                return;
            }
        });
        return retVal;
    }

    // get list for dialogs
    @Get('list')
    async getList(
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
            if (retVal.arr.at(-1)?.id === 1){
                retVal.arr.pop();
            }
            [result] = await conn.execute<RowDataPacket[]>(
                `select file_name as name, file_serial as id from file where user_serial=? and parent_serial=? and type='dir' and issys='false'`, [userSer, dirid]);
            retVal.arr = retVal.arr.concat(result as FileListResDto['arr']);
            if (select === 'sepall'){
                [result] = await conn.execute<RowDataPacket[]>(
                    `select file_name as name, file_serial as id, last_renamed as timestamp from file where user_serial=? and parent_serial=? and type<>'dir' and issys='false'`, [userSer, dirid]);
                retVal.arr2 = result as FileListResDto['arr2'];
            }
        });
        try {
            retVal.path = (await this.filesService.getDirInfo(await this.mysqlService.getSQL(), userSer, dirid)).path;
        } catch (err) {
            retVal.path = '오류가 발생했습니다.';
            console.log(err);
        }
        return retVal;
    }
}
