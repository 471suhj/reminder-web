import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { RowDataPacket, Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { FilesGetDto } from './files-get.dto';
import { PrefsService } from 'src/prefs/prefs.service';
import { SysdirType } from './sysdir.type';
import { FileDelResDto } from './file-del-res.dto';
import { FileIdentResDto } from './file-ident-res.dto';
import { FileIdentReqDto } from './file-ident-req.dto';
import { FilesArrDto } from './files-arr.dto';
import { FileShareResDto } from './file-share-res.dto';
import { FileNewResDto } from './file-new-res.dto';
import { FileMoveResDto } from './file-move-res.dto';
import { SortModeDto } from './sort-mode.dto';
import { DataSource, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual } from 'typeorm';
import type { FindOptionsWhere, FindOptionsOrder } from 'typeorm';
import { Efile } from 'src/mysql/file.entity';
import { FilesMoreDto } from './files-more.dto';
import { Ebookmark } from './bookmark.entity';
import { Eshared_def } from 'src/mysql/shared_def.entity';
import { Erecycle } from 'src/mysql/recycle.entity';
import { FriendMoreDto } from './friend-more.dto';
import { Efriend_mul } from 'src/mysql/friend_mul.entity';

@Injectable()
export class FilesService {
    constructor(private readonly mysqlService: MysqlService, private readonly prefsService: PrefsService,
        private readonly dataSource: DataSource){}

    private readonly logger = new Logger(FilesService.name);

    async getUserRoot(userSer: number, type: SysdirType['val']){
        const pool: Pool = await this.mysqlService.getSQL();
        if (!SysdirType.arr.includes(type)){
            throw new InternalServerErrorException();
        }
        try {
            let [result] = await pool.execute<RowDataPacket[]>(
                `select file_serial from file where user_serial=? and issys='true' and file_name='${type}'`, [userSer]);
            if (result.length <= 0){
                throw new Error('files service mysql: root folder cannot be found userid=' + userSer);
            }
            return Number(result[0].user_serial);
        } catch (err) {
            this.logger.error('files service mysql error. see below.');
            console.log(err);
            throw new InternalServerErrorException();
        }
    }

    async makePath(conn: PoolConnection, userSer: number, path: string){
        let dirid = await this.getUserRoot(userSer, 'files');
        let arrName = path.split('/');
        let level = 1; // not 0
        let result: RowDataPacket[];
        let str1 = `select file_serial from file `;
        str1 += `where user_serial=? and parent_serial=? and file_name=? and type='dir' `;
        str1 += 'for update';
        while (level < arrName.length){
            [result] = await conn.execute<RowDataPacket[]>(
                str1, [userSer, dirid, arrName[level]]
            );
            if (result.length <= 0){
                await conn.execute<RowDataPacket[]>(
                    `insert into file (user_serial, parent_serial, type, file_name) value ?`,
                    [userSer, dirid, 'dir', arrName[level]]
                );
                [result] = await conn.execute<RowDataPacket[]>(
                    str1, [userSer, dirid, arrName[level]]
                );
            }
            dirid = result[0].file_serial;
            level++;
        }
        return dirid;
    }

    // includes user verification
    async getDirInfo(userSer: number, fileId: number): Promise<{path: string, pathHtml: string, parentId: number, dirName: string}>{
        let path = '';
        let pathHtml = '';
        let parentId = 0;
        let dirName = '';
        let cont = true;
        let result: RowDataPacket[];
        let curId = fileId;
        let accessErr = false;
        await this.mysqlService.doTransaction('files service getPath', async function(conn, rb){
            while (cont){
                let firstReq = true;
                [result] = await conn.execute<RowDataPacket[]>( // for repeatable read
                    'select parent_serial, file_name from file where user_serial=? and file_serial=? for share', [userSer, fileId]);
                if (result.length <= 0) {
                    if (firstReq){
                        rb.rback = true;
                        accessErr = true;
                        return;
                    } else {
                        throw new Error('result is empty');
                    }
                }
                if (firstReq){
                    parentId = Number(result[0].parent_serial);
                    dirName = String(result[0].file_name);
                }
                path = result[0].file_name + path;
                pathHtml = `<a class="addrLink" href="/files?dirid=${curId}">${result[0].file_name}</a>`+ pathHtml;
                if (Number(result[0].parent_serial) === curId){
                    cont = false;
                } else {
                    path = '/' + path;
                    pathHtml = '/' + pathHtml;
                    curId = Number(result[0].parent_serial);
                    firstReq = false;
                }
            }
        });
        if (accessErr){
            throw new BadRequestException();
        }
        return {path, pathHtml, parentId, dirName};
    }

    async renderFilesPage(userSer: number, dirid: number): Promise<FilesGetDto>{
        let retObj: FilesGetDto = new FilesGetDto();
        // includes user verification
        const {path, pathHtml, parentId, dirName} = await this.getDirInfo(userSer, dirid);
        
        retObj.countItem = 'false';
        retObj.path = path;
        retObj.uplink = '/files?dirid=' + String(parentId);
        retObj.dirName = dirName;
        retObj.dirPath = pathHtml;
        retObj.dirId = dirid;

        retObj = {...retObj, ...(await this.prefsService.getUserCommon(userSer, 'files'))};
        return retObj;
    }

    async renderSharedPage(userSer: number, dirType: SysdirType['val']): Promise<FilesGetDto>{
        if (!SysdirType.arr.includes(dirType)){
            throw new BadRequestException();
        }
        let retObj: FilesGetDto = new FilesGetDto();
        const dirid = await this.getUserRoot(userSer, dirType);

        retObj.countItem = 'false';
        retObj.path = 'files/' + dirType;
        retObj.uplink = '/files';
        retObj.dirName = SysdirType.translate(dirType);
        retObj.dirPath = `<a class="addrLink" href="/files">files</a>/<a class="addrLink" href="/files/${dirType}">${dirType}</a>`;
        retObj.dirId = dirid;
        let sideName =  (dirType === 'recycle' || dirType === 'inbox') ? 'files' : dirType;
        retObj = {...retObj, ...(await this.prefsService.getUserCommon(userSer, sideName))}; // overwritten
        return retObj;
    }

    async checkTimestamp(conn: PoolConnection, userSer: number, fileSer: number, time: Date, mode?: 'dir'|'file'){
        let str1 = `select file_serial from file where user_serial=? and fileSer=? and last_renamed=? `
        if (mode === 'dir'){
            str1 += `and type='dir' `;
        } else if (mode === 'file'){
            str1 += `and type<>'dir' `;
        }
        let [result] = await conn.execute<RowDataPacket[]>(
            str1 + 'for share', [userSer, fileSer, time]
        );
        return (result.length > 0);
    }

    async checkAccess(conn: PoolConnection, userSer: number, fileSer: number, mode?: 'dir'|'file', nosys?: 'true'|'fileonly'){
        let str1 = `select file_serial from file where user_serial=? and fileSer=? `;
        if (mode === 'dir'){
            str1 += `and type='dir' `;
        } else if (mode === 'file'){
            str1 += `and type='file' `;
        }
        if (nosys === 'fileonly'){
            str1 += `and (file_name='files' or issys='false') `;
        } else if (nosys === 'true'){
            str1 += `and issys='false' `;
        }
        let [result] = await conn.execute<RowDataPacket[]>(
            str1 + 'for share',
            [userSer, fileSer]
        );
        return (result.length > 0);
    }

    private translateColumnBase(val: string, mode: SysdirType['val']){
        switch(val){
            case 'colName':
                return ['file_name'];
            case 'colDate':
                return ['last_modified', 'file_name'];
            case 'colOwner':
                return ['user_serial', 'file_name'];
            case 'colPath':
                if (mode === 'recycle'){return ['parent_path', 'file_name'];} else {break;}
            case 'colDelDate':
                if (mode === 'recycle'){return ['last_renamed', 'file_name'];} else {break;} // thrown for maintainability
        }
        throw new BadRequestException();
    }

    async loadFileMore(userSer: number, dir: number, lastFile: number, lastTime: Date, sort: SortModeDto){
        let crit = ['type', ...this.translateColumnBase(sort.criteria, 'files')];
        let retVal = new FilesMoreDto();
        retVal.addarr = [];
        retVal.loadMore = true;
        try{
        await this.dataSource.transaction('SERIALIZABLE', async manager=>{
            let result = await manager.find(Efile, {
                where: {
                    user_serial: userSer,
                    parent_serial: dir,
                    file_serial: dir
                }
            });
            if (result.length <= 0){
                throw new BadRequestException();
            }
            let whereObj = {
                user_serial: userSer,
                parent_serial: dir
            };
            let wherearr: FindOptionsWhere<Efile>[] = [];
            if (lastFile !== 0){
                result = await manager.find(Efile, {
                    where: {
                        user_serial: userSer,
                        parent_serial: dir,
                        file_serial: lastFile,
                        last_renamed: lastTime
                    }
                });
                if (result.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback');
                }
                let lenTmp = crit.length;
                for (let i = 0; i < lenTmp; i++){
                    wherearr.push({...whereObj});
                    let j = 0;
                    for (; j < lenTmp - 1 - i; j++){
                        wherearr[i][crit[j]] = result[0][crit[j]];
                    }
                    wherearr[i][crit[j]] = sort.incr ? MoreThan(result[0][crit[j]]) : LessThan(result[0][crit[j]]);
                }
            } else {
                wherearr = [whereObj];
            }
            let orderObj = {};
            for (const itm of crit){
                    orderObj[itm] = sort.incr ? "ASC" : "DESC";
            }
            result = await manager.find(Efile, {
                relations: {
                    shares: true
                },
                where: wherearr,
                take: 21,
                order: orderObj
            });
            if (result.length > 20){
                retVal.loadMore = true;
                result.pop();
            } else {
                retVal.loadMore = false;
            }
            retVal.addarr = result.map(val=>{return {
                link: (val.issys === 'true' ? `/files/${val.file_name}` 
                    : (val.type === 'dir' ? `/files?dirid=${val.file_serial}` : `/edit?id=${val.file_serial}`)),
                id: val.file_serial,
                isFolder: val.type === 'dir',
                text: val.file_name,
                bookmarked: val.bookmarked === 'true',
                shared: val.shares.map(val=>val.user_serial_to).join(','),
                date: (val.last_modified as Date).toISOString(),
                timestamp: val.last_renamed.toISOString()
            };});
        });
        } catch (err){
            if (err.message !== 'rollback'){
                throw err;
            }
        }
        await this.replaceNames(userSer, retVal.addarr);
        return retVal;
    }

    // create a view for this!
    async loadBookmarkMore(userSer: number, lastFile: number, lastTime: Date, sort: SortModeDto){
        let crit = ['type', ...this.translateColumnBase(sort.criteria, 'bookmarks')];
        let retVal = new FilesMoreDto();
        retVal.addarr = [];
        retVal.loadMore = true;
        try{
        await this.dataSource.transaction('SERIALIZABLE', async manager=>{
            let whereObj = {
                reader: userSer,
            }
            let wherearr: FindOptionsWhere<Ebookmark>[] = [];
            if (lastFile !== 0){
                let result2 = await manager.find(Efile, {
                    where: [{
                        user_serial: userSer,
                        file_serial: lastFile,
                        last_renamed: lastTime
                    },{
                        file_serial: lastFile,
                        last_renamed: lastTime,
                        shares: {
                            user_serial_to: userSer
                        }
                    }]
                });
                if (result2.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback');
                }
                let lenTmp = crit.length;
                for (let i = 0; i < lenTmp; i++){
                    wherearr.push({...whereObj});
                    let j = 0;
                    for (; j < lenTmp - 1 - i; j++){
                        wherearr[i][crit[j]] = result2[0][crit[j]];
                    }
                    wherearr[i][crit[j]] = sort.incr ? MoreThan(result2[0][crit[j]]) : LessThan(result2[0][crit[j]]);
                }
            } else {
                wherearr = [whereObj];
            }
            let orderObj: FindOptionsOrder<Ebookmark> = {};
            for (const itm of crit){
                    orderObj[itm] = sort.incr ? "ASC" : "DESC";
            }
            let result = await manager.find(Ebookmark, {
                relations: {
                    shares: true
                },
                where: wherearr,
                take: 21,
                order: orderObj
            });
            if (result.length > 20){
                retVal.loadMore = true;
                result.pop();
            } else {
                retVal.loadMore = false;
            }
            retVal.addarr = result.map(val=>{return {
                link: (val.issys === 'true' ? `/files/${val.file_name}` 
                    : (val.type === 'dir' ? `/files?dirid=${val.file_serial}` : `/edit?id=${val.file_serial}`)),
                id: val.file_serial,
                isFolder: val.type === 'dir',
                text: val.file_name,
                bookmarked: true,
                shared: val.shares.map(val=>val.user_serial_to).join(', '),
                date: (val.last_modified as Date).toISOString(),
                ownerImg: '/images/user',
                timestamp: val.last_renamed.toISOString()
            };});
        });
        } catch (err) {
            if (err.message !== 'rollback') {throw err;}
        }
        await this.replaceNames(userSer, retVal.addarr);
        return retVal;  
    }

    async loadSharedMore(userSer: number, lastFile: number, lastTime: Date, sort: SortModeDto, friend?: number){
        let crit = ['type', ...this.translateColumnBase(sort.criteria, 'shared')];
        let retVal = new FilesMoreDto();
        retVal.addarr = [];
        retVal.loadMore = true;
        try{
        await this.dataSource.transaction('SERIALIZABLE', async manager=>{
            let whereObj = {
                user_serial_to: userSer,
                user_serial_from: friend
            };
            let wherearr: FindOptionsWhere<Eshared_def>[] = [];
            let result: Efile[];
            if (lastFile !== 0){
                result = await manager.find(Efile, {
                    relations: {
                        shares: true,
                    },
                    where: {
                        file_serial: lastFile,
                        last_renamed: lastTime,
                        shares: {
                            user_serial_to: userSer
                        },
                        user_serial: friend
                    }
                });
                if (result.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback');
                }
                let lenTmp = crit.length;
                for (let i = 0; i < lenTmp; i++){
                    wherearr.push({...whereObj});
                    let j = 0;
                    wherearr[i].file = {};
                    for (; j < lenTmp - 1 - i; j++){
                        wherearr[i].file![crit[j]] = result[0][crit[j]];
                    }
                    wherearr[i].file![crit[j]] = sort.incr ? MoreThan(result[0][crit[j]]) : LessThan(result[0][crit[j]]);
                }
            } else {
                wherearr = [whereObj];
            }
            let orderObj = {file: {}};
            for (const itm of crit){
                    orderObj.file[itm] = sort.incr ? "ASC" : "DESC";
            }
            let result2 = await manager.find(Eshared_def, {
                relations: {
                    file: true,
                    friend_mono: true
                },
                where: wherearr,
                take: 21,
                order: orderObj,
            });
            if (result2.length > 20){
                retVal.loadMore = true;
                result2.pop();
            } else {
                retVal.loadMore = false;
            }
            retVal.addarr = result2.map(val=>{return {
                link: `/files?dirid=${val.file_serial}`,
                id: val.file_serial,
                isFolder: val.file.type === 'dir',
                text: val.file_name,
                bookmarked: val.bookmarked === 'true',
                shared: val.file.shares.map(val=>val.user_serial_to).join(','),
                date: (val.file.last_modified as Date).toISOString(),
                ownerName: val.friend_mono.nickname,
                ownerImg: '/images/user?id=' + val.user_serial_from,
                timestamp: val.file.last_renamed.toISOString()
            };});
        });
        } catch (err) {
            if (err.message !== 'rollback'){throw err;}
        }
        await this.replaceNames(userSer, retVal.addarr);
        return retVal;
    }

    async loadRecycleMore(userSer: number, lastFile: number, lastTime: Date, sort: SortModeDto){
        let crit = ['type', ...this.translateColumnBase(sort.criteria, 'recycle')];
        let retVal = new FilesMoreDto();
        retVal.addarr = [];
        retVal.loadMore = true;
        try{
        await this.dataSource.transaction('SERIALIZABLE', async manager=>{
            let whereObj: FindOptionsWhere<Erecycle> = {
                user_serial: userSer,
                del_type: 'direct'
            };
            let wherearr: FindOptionsWhere<Erecycle>[] = [];
            if (lastFile !== 0){
                let result = await manager.find(Erecycle, {
                    where: {
                        user_serial: userSer,
                        file_serial: lastFile,
                        last_renamed: lastTime
                    }
                });
                if (result.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback');
                }
                let lenTmp = crit.length;
                for (let i = 0; i < lenTmp; i++){
                    wherearr.push({...whereObj});
                    let j = 0;
                    for (; j < lenTmp - 1 - i; j++){
                        wherearr[i][crit[j]] = result[0][crit[j]];
                    }
                    wherearr[i][crit[j]] = sort.incr ? MoreThan(result[0][crit[j]]) : LessThan(result[0][crit[j]]);
                }
            } else {
                wherearr = [whereObj];
            }
            let orderObj = {};
            for (const itm of crit){
                    orderObj[itm] = sort.incr ? "ASC" : "DESC";
            }
            let result2 = await manager.find(Erecycle, {
                where: wherearr,
                take: 21,
                order: orderObj
            });
            if (result2.length > 20){
                retVal.loadMore = true;
                result2.pop();
            } else {
                retVal.loadMore = false;
            }
            retVal.addarr = result2.map(val=>{return {
                id: val.file_serial,
                isFolder: val.type === 'dir',
                text: val.file_name,
                date: (val.last_modified as Date).toISOString(),
                timestamp: val.last_renamed.toISOString(),
                origPath: val.parent_path,
                dateDeleted: val.last_renamed.toISOString(),
            };});
        });
        } catch (err) {
            if (err.message !== 'rollback') {throw err;}
        } 
        return retVal;
    }

    async loadFriendMore(userSer: number, lastFriend: number, sort: SortModeDto){
        let crit: string[];
        if (sort.criteria === 'colName'){
            crit = ['nickname', 'user_serial_from', 'user_serial_to'];
        } else if (sort.criteria === 'colAdded'){
            crit = ['date_added', 'user_serial_from', 'user_serial_to'];
        } else {throw new BadRequestException();}
        let retVal = new FriendMoreDto();
        retVal.addarr = [];
        retVal.loadMore = true;
        try{
        await this.dataSource.transaction('SERIALIZABLE', async manager=>{
            let whereObj: FindOptionsWhere<Efriend_mul> = {
                user_serial_to: userSer,
            };
            let wherearr: FindOptionsWhere<Efriend_mul>[] = [];
            if (lastFriend !== 0){
                let result = await manager.find(Efriend_mul, {
                    where: {
                        user_serial_to: userSer,
                        user_serial_from: lastFriend,
                    }
                });
                if (result.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback');
                }
                let lenTmp = crit.length;
                for (let i = 0; i < lenTmp; i++){
                    wherearr.push({...whereObj});
                    let j = 0;
                    for (; j < lenTmp - 1 - i; j++){
                        wherearr[i][crit[j]] = result[0][crit[j]];
                    }
                    wherearr[i][crit[j]] = sort.incr ? MoreThan(result[0][crit[j]]) : LessThan(result[0][crit[j]]);
                }
            } else {
                wherearr = [whereObj];
            }
            let orderObj = {};
            for (const itm of crit){
                    orderObj[itm] = sort.incr ? "ASC" : "DESC";
            }
            let result2 = await manager.find(Efriend_mul, {
                where: wherearr,
                take: 21,
                order: orderObj
            });
            if (result2.length > 20){
                retVal.loadMore = true;
                result2.pop();
            } else {
                retVal.loadMore = false;
            }
            retVal.addarr = result2.map(val=>{return {
                link: '/friends/profile?id=' + val.user_serial_from,
                profileimg: '/images/user?id=' + val.user_serial_from,
                nickname: val.nickname,
                name: '',
                userid: '',
                sharedFiles: '',
                id: val.user_serial_from,
            };});
        });
        } catch (err) {
            if (err.message !== 'rollback') {throw err;}
        }
        return retVal;
    }

    private async friendLoad_fillInfo(lst: FilesArrDto['arrFriend']){
        let mapArr = new Map(lst.map(val=>[val.id, val]));
        let arrSerial = lst.map(val=>val.id);
        await this.mysqlService.doQuery('files service friendload fillinfo', async (conn)=>{
            let [result] = await conn.execute<RowDataPacket[]>(
                `select user_serial, name, user_id from user where user_serial in ?`, [arrSerial]
            );
            for (const val of result){
                let itm = mapArr.get(val.user_serial);
                if (itm === undefined){continue;}
                itm.name = val.name;
                itm.userid = val.user_id;
                if (itm.nickname === ''){
                    itm.nickname = val.name;
                }
            }
            [result] = await conn.execute<RowDataPacket[]>(
                `select user_serial_from, file_name from shared_def where user_serial_from in ?`, [arrSerial]
            );
            for (const val of result){
                let itm = mapArr.get(val.user_serial_from);
                if (itm === undefined){continue;}
                itm.sharedFiles += val.file_name;
                itm.sharedFiles += ', ';
            }
            for (const [_, val] of mapArr){
                val.sharedFiles = val.sharedFiles.slice(0, -2);
            }
        });

    }

    async resolveLoadmore(userSer: number, lst: FileIdentReqDto[], lastfile: number, timestamp: Date, sort: SortModeDto,
        context: 'files'|'bookmarks'|'recycle'|'shared', dirOrFriend?: number
    ){
        if (lst.at(-1)?.id === 0){
            lst.pop();
        } else {
            return;
        }
        let ret: FilesMoreDto;
        if (context === 'bookmarks'){
            ret =  await this.loadBookmarkMore(userSer, lastfile, timestamp, sort);
        } else if (context === 'files' && dirOrFriend){
            ret = await this.loadFileMore(userSer, dirOrFriend, lastfile, timestamp, sort);
        } else if (context === 'recycle'){
            ret = await this.loadRecycleMore(userSer, lastfile, timestamp, sort);
        } else if (context === 'shared'){
            ret = await this.loadSharedMore(userSer, lastfile, timestamp, sort, dirOrFriend);
        } else {throw new BadRequestException();}

        lst = lst.concat(ret.addarr.map(val=>{return {id: val.id, timestamp: new Date(val.timestamp)}}));
    }

    async resolveFriendLoadmore(userSer: number, lst: number[], lastfriend: number, sort: SortModeDto){
        if (lst.at(-1) === 0){
            lst.pop();
        } else {
            return;
        }
        let ret = await this.loadFriendMore(userSer, lastfriend, sort);
        lst = lst.concat(ret.addarr.map(val=>val.id));
    }

    async replaceNames(userSer: number, lst: FilesArrDto['arr']){
        let arrnames = new Set()
        for (const val of lst.map(val=>val.shared)){
            if (val === undefined){return;}// as all of the shared will actually be undefined.
            for (let itm of val.split(',')){
                arrnames.add(Number(itm));
            }
        }
        let result: RowDataPacket[] = [];
        await this.mysqlService.doQuery('files service replaceNames', async (conn)=>{
            let str1 = `select user_serial, ifnull(nickname, name) as nickname, name from file left join friend_mono `;
            str1 += `on file.user_serial=friend_mono.user_serial_from and friend_mono.user_serial_to=? `;
            str1 += `where user_serial in ?`;
            [result] = await conn.execute<RowDataPacket[]>(
                str1, [userSer, Array.from(arrnames)]
            );
        });
        let mapnames = new Map<number, string>(result.map(val=>[val.user_serial, val.nickname === '' ? val.name : val.nickname]));
        for (let i = 0; i < lst.length; i++){
            lst[i].shared = lst[i].shared!.split(',').map(val=>mapnames.get(Number(val))).join(', ');
        }
    }

    async addSharedNames(lst: FilesArrDto['arr']){
        let str1 = `select file_serial, shared_def.user_serial_to as id `;
        str1 += `from shared_def where file_serial in ?`;
        let result: RowDataPacket[] = [];
        await this.mysqlService.doQuery('files service addSharedNames', async (conn)=>{
            [result] = await conn.execute<RowDataPacket[]>(
                str1, [lst.map(val=>val.id)]
            );
        });
        let mapFile = new Map(lst.map(val=>[val.id, val]));
        for (const itm of result){
            let obj = mapFile.get(itm.file_serial);
            if (obj === undefined){this.logger.error('addSharedNames: object not found for '+itm.file_serial);continue;}
            obj.shared += (itm.id + ',');
        }
        for (const itm of lst){
            itm.shared!.slice(0, -1);
        }
    }
    
    private async deleteFiles_validity(conn: PoolConnection, userSer: number, arr_: readonly FileIdentReqDto[]){
        let arr = arr_.slice(0);
        let str1 = `select file_serial as id, last_renamed as timestamp from file `;
        str1 += `where user_serial=? and (file_serial,last_renamed) in ?) `;
        str1 += 'for update';
        let arr2 = arr.map((val)=>(val.timestamp.toISOString() + val.id));
        let retArr: Array<[number, string]> = [];
        let [result] = await conn.execute<RowDataPacket[]>(
            str1, [userSer, arr.map((val)=>[val.id, val.timestamp])]
        );
        for (let i = 0; i < result.length; i++){
            let idxTmp = arr2.indexOf(result[i].timestamp.toISOString() + result[i].id);
            if (idxTmp === -1){continue;}
            arr2.splice(idxTmp, 1);
            let itmTmp = arr.splice(idxTmp, 1)[0];
            retArr.push([itmTmp.id, itmTmp.timestamp.toISOString()]);
        }
        return {arr: retArr, arrFail: arr.map<[number, string]>((val)=>{return [val.id, val.timestamp.toISOString()];})};
    }

    private async deleteFiles_mark(conn: PoolConnection, userSer: number, arr_: readonly [number, string][]){
        let arr = new Map(arr_);
        let str1 = `update file set to_delete='direct' `;
        str1 += `where user_serial=? and file_serial in ? `;
        // str1 += 'for update';
        await conn.execute<RowDataPacket[]>(
            str1, [userSer, Array.from(arr.keys())]
        );
        str1 = `select file_serial from file `;
        str1 += `where user_serial=? and to_delete='direct' for update `;
        let [result] = await conn.execute<RowDataPacket[]>(
            str1, [userSer]
        );
        let retArr: [number, string][] = [];
        for (let i = 0; i < result.length; i++){
            let valTmp = arr.get(result[i].file_serial);
            if (valTmp === undefined){this.logger.error('deletefiles_mark: '+result[i].file_serial);continue;}
            retArr.push([result[i].file_serial, valTmp]);
            arr.delete(result[i].file_serial);
        }
        return {arr: retArr, arrFail: Array.from(arr)};
    }

    private async deleteFiles_recurse(conn: PoolConnection, userSer: number, arr_: readonly number[]){
        let arr = arr_.slice();
        let str1 = `update file set to_delete='recursive' `;
        str1 += `where user_serial=? and parent_serial in ? `;
        await conn.execute<RowDataPacket[]>(str1, [userSer, arr]);

        str1 = `select file_serial as id from file `;
        str1 += `where user_serial=? and parent_serial in ? and type='dir' `;
        str1 += 'for update';
        let [result] = await conn.execute<RowDataPacket[]>(
            str1, [userSer, arr]
        );
        return result.map((val)=>val.id);
    }

    private async deleteFiles_removeShares(conn: PoolConnection, userSer: number){
        let subq = `select file_serial from file where user_serial=? and to_delete<>'na' for update`;
        let str1 = `delete from shared_def `;
        str1 += `where user_serial_from=? and file_serial in (${subq}) `;
        // str1 += 'for update';
        await conn.execute<RowDataPacket[]>(
            str1, [userSer, userSer]
        );
    }

    private async deleteFiles_toRecycle(conn: PoolConnection, userSer: number, origPath: string){
        let str1 = `insert into recycle (user_serial, parent_serial, type, file_name, file_serial, last_modified, del_type, parent_path) `;
        let subq = `user_serial, parent_serial, type, file_name, file_serial, last_modified, to_delete, ?`;
        str1 += `select ${subq} from file where user_serial=? and to_delete<>'na' and issys='false' `;
        // str1 += 'for update';
        await conn.execute<RowDataPacket[]>(
            str1, [origPath, userSer]
        );
    }

    private async deleteFiles_remove(conn: PoolConnection, userSer: number){
        let str1 = `delete from file `;
        str1 += `where user_serial=? and to_delete<>'na' and issys='false' `;
        // str1 += 'for update';
        await conn.execute<RowDataPacket[]>(
            str1, [userSer]
        );
    }

    async deleteFiles(conn: PoolConnection, userSer: number, arr_: readonly FileIdentReqDto[],
        from: number, rb: {rback: boolean}|'force'): Promise<FileDelResDto>{
        // deleting folders: need recursive action - mark with to_delete
        // also remove shared_def for all recursively deleted ones
        // do not delete sysdirs.
        let arrFail2: [number, string][] = [];
        let result;
        let {arr, arrFail} = await this.deleteFiles_validity(conn, userSer, arr_);
        ({arr, arrFail: arrFail2} = await this.deleteFiles_mark(conn, userSer, arr));
        arrFail.push(...arrFail2);
        result = Array.from(arr.keys());
        while (result.length > 0) {
            [result] = await this.deleteFiles_recurse(conn, userSer, result);
        }
        await this.deleteFiles_removeShares(conn, userSer);
        const { path } = await this.getDirInfo(userSer, from);
        if (path.length > 255 && rb !== 'force'){ // too long and not force
            rb.rback = true;
            let retVal = new FileDelResDto();
            retVal.failed = arr_.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
            retVal.delarr = [];
            retVal.failmessage = '파일 경로가 너무 길어서 휴지통으로 이동할 수 없었습니다. 파일을 다른 경로로 이동한 후 다시 시도하십시오.';
            return retVal;
        } else if (path.length <= 255){ // not too long
            await this.deleteFiles_toRecycle(conn, userSer, path);
        } // else: too long and force -->do not put into recycle.
        await this.deleteFiles_remove(conn, userSer);
        let retVal = new FileDelResDto();
        retVal.delarr = Array.from(arr, (val)=>{return {id: val[0], timestamp: val[1]};})
        retVal.failed = arrFail.map((val)=>{return {id: val[0], timestamp: val[1]};});
        return retVal;
    }

    async moveFiles_validateFiles(conn: PoolConnection, userSer: number, dirfrom: number, files_: readonly [number, Date][]){
        const str1 = `select file_serial, last_renamed, type, file_name from file where user_serial=? and parent_serial=? and (file_serial, last_renamed) in ? for update`;
        let [resName] = await conn.execute<RowDataPacket[]>(str1, [userSer, dirfrom, files_]);
        let arr = files_.slice();
        let arr2 = arr.map(val=>val[1].toISOString() + val[0]);
        let retArr = new Map<number, Date>();
        for (let i = 0; i < resName.length; i++){
            let idx = arr2.indexOf(resName[i].last_renamed.toISOString() + resName[i].file_serial);
            if (idx === -1){this.logger.error('movefiles_validatefiles: ' + userSer);console.log(resName[i]);continue;}
            arr2.splice(idx, 1);
            let tval = arr.splice(idx, 1)[0];
            retArr.set(tval[0], tval[1]);
        }
        return {retArr, arrFail: arr, resName: resName.map<[string, string]>(val=>[val.type, val.file_name])};
    }

    // do not modify _arr
    // deals with both move and copy. use 'del' parameter
    async moveFiles_rename(conn: PoolConnection, userSer: number, del: boolean, from: number, to: number, arr_: readonly {file_serial: number, file_name: string, type: string, timestamp: Date}[]){
        let arr = new Map(arr_.map<[number, [string, string, Date]]>(val=>[val.file_serial, [val.type, val.file_name, val.timestamp]]));
        let arrDirName = new Map<string, [number, Date]>();
        let arrFileName = new Map<string, [number, Date]>();
        arr_.forEach(val=>((val.type==='dir') ? arrDirName.set(val.file_name, [val.file_serial, val.timestamp]) : arrFileName.set(val.file_name, [val.file_serial, val.timestamp])));
        let str1 = '';
        // create entries. inserted entries can now be identified with types.
        if (del) { // move
            str1 = `update file set type=if(type='dir','movedir','movefile'), parent_serial=?, last_renamed=current_timestamp `;
            str1 += `where user_serial=? and parent_serial=? and file_serial in ? `;
            await conn.execute<RowDataPacket[]>(str1, [to, userSer, from, Array.from(arr.keys())]);
        } else { // copy
            str1 = `insert into file (user_serial, parent_serial, type, file_name, last_modified) `;
            str1 += `select ?, ?, type, file_name, last_modified from file `;
            str1 += `where user_serial=? and parent_serial=? and file_serial in ? `;
            await conn.execute<RowDataPacket[]>(str1, [userSer, to, userSer, from, Array.from(arr.keys())]);
        }
        // don't forget to update last_renamed\
        // also revert the types
        // restore failed items to original
        str1 = `select file_serial from file `
        str1 += `where user_serial=? and parent_serial=? and type in ('movedir', 'movefile') and char_length(file_name) > ? `;
        str1 += 'for update';
        // 5, 6: move only
        let str5 = `select * from file where user_serial=? and file_serial in ? `;
        let str2 = `delete from file where user_serial=? and file_serial in ? `;
        let str6 = `insert into file values ? `;
        let str3 = `update file set file_name=concat(file_name, '-2') `
        str3 += `where user_serial=? and parent_serial=? and (type='movedir' or type='movefile') `;
        let subq = `select file_name from file where user_serial=? and parent_serial=? for update `;
        let str4 = `update file set type=if(type='movedir','dir','file'), last_renamed=current_timestamp where (type='movedir' or type='movefile') and file_name not in (${subq}) `;
        let str7 = `select file_serial from file where user_serial=? and (type='movedir' or type='movefile') for update `;
        let result: RowDataPacket[];
        let arrFail: [number, Date][] = [];
        let cnt = 0;
        while(true){
            // select files with names too long
            [result] = await conn.execute<RowDataPacket[]>(str1, [userSer, to, 40-2]);
            // fetch info about those files
            let [result2] = await conn.execute<RowDataPacket[]>(
                {sql: str5, rowsAsArray: true}, [userSer, result.map(val=>val.file_serial)]);
                // delete the files
            await conn.execute<RowDataPacket[]>(str2, [userSer, result.map(val=>val.file_serial)]);
            for (let i = 0; i < result2.length; i++){
                // add to info
                if (del) {
                    let tval = arr.get(result2[i][0]);
                    if (tval === undefined){this.logger.error('movefiles_rename: ' + userSer);console.log(result2[i][0]);continue;}
                    arrFail.push([result2[i][0], tval[2]]);
                    arr.delete(result2[i][0]);
                    (result2[i][3] === 'dir' ? arrDirName : arrFileName).delete(result2[i][5]);
                    result2[i][5] = tval[1];
                    result2[i][3] = tval[0];
                } else {
                    let tname = result2[i][5].slice(0, (-2)*cnt);
                    let tval = (result2[i][3] === 'dir') ? arrDirName.get(tname) : arrFileName.get(tname);
                    if (tval === undefined){this.logger.error('movefiles_rename: ' + userSer);console.log(result2[i][0]);continue;}
                    arrFail.push(tval);
                    arr.delete(tval[0]);
                    (result2[i][3] === 'dir' ? arrDirName : arrFileName).delete(result2[i][5]);
                }
            }
            //re-insert failed files
            if (del){
                await conn.execute<RowDataPacket[]>(str6, [result2]);
            }
            // change remaining file names
            await conn.execute<RowDataPacket[]>(str3, [userSer, to]);
            // update file types of files with suitable filenames
            await conn.execute<RowDataPacket[]>(str4, [userSer, to]);
            // check for unresolved files
            [result] = await conn.execute<RowDataPacket[]>(str7, [userSer]);
            let arrFileN2: typeof arrFileName = new Map();
            let arrDirN2: typeof arrDirName = new Map();
            arrFileName.forEach((val, key)=>{arrFileN2.set(key + '-2', val)});
            arrDirName.forEach((val, key)=>{arrDirN2.set(key + '-2', val)});
            arrFileName = arrFileN2;
            arrDirName = arrDirN2;
            for (let i = 0; i < result.length; i++){
                result[i].file_serial
            }
            if (result.length <= 0){break;}
            cnt++;
        }
        // get info about newly added files
        [result] = await conn.execute<RowDataPacket[]>(
            `select * from file where user_serial=? and file_serial in ? for share `, [userSer, Array.from(arr.keys())]);
        let addarr: FilesArrDto['arr'] = result.map((val)=>{
            return {
                link: val.type==='dir' ? `/files?dirid=${val.file_serial}` : `/edit?id=${val.file_serial}`,
                id: val.file_serial,
                isFolder: val.type==='dir',
                text: val.file_name,
                bookmarked: val.bookmarked==='true',
                shared: '',
                date: val.last_modified.toISOString(),
                ownerImg: '/images/user',
                timestamp: val.last_renamed.toISOString()
            };
        });

        return {arrFail, addarr, delarr: Array.from(arr).map(val=>{return{id: val[0], timestamp: val[1][2].toISOString()};})};
    }

    // important!
    // mark shouldn't be used by restore mechanism. it is used by sharecopy.
    private async restoreFiles_checkPath(conn: PoolConnection, userSer: number, arr_: FileIdentReqDto[]){
        let arr = arr_.slice();
        let arr2 = arr.map((val)=>val.id);
        // fetch names and other info
        let str1 = `select file_serial, parent_path, file_name, type from recycle `;
        str1 += `where user_serial=? and (file_serial, file_timestamp) in ? order by parent_path `;
        str1 += 'for update';
        let [result] = await conn.execute<RowDataPacket[]>(
            str1, [userSer, arr.map((val)=>[val.id, val.timestamp])]
        );
        // make path (call makepath), and check for name clashes
        str1 = `select file_serial from file `;
        str1 += `where user_serial=? and parent_serial=? and file_type=? and file_name=? `;
        str1 += 'for update';
        let curPath = '';
        let dirid: number;
        let namechange = false;
        let retArr: Array<FileIdentReqDto> = [];
        for (let i = 0; i < result.length; i++){
            if (curPath !== result[i].parent_path){
                curPath = result[i].parent_path;
                dirid = await this.makePath(conn, userSer, curPath);
            }
            let newname = result[i].file_name;
            let toolong = false;
            while(true){
                let [result2] = await conn.execute<RowDataPacket[]>(
                    str1, [userSer, dirid!, result[i].type, newname]
                );
                if (result2.length <= 0){
                    break;
                }
                newname += '-2';
                namechange = true;
                if (newname.length > 40){
                    toolong = true;
                    break;
                }
            }
            if (toolong){continue;}
            let str2 = `update recycle set file_name=?, parent_serial=? where user_serial=? and file_serial=? `;
            await conn.execute<RowDataPacket[]>(str2, [newname, dirid!, userSer, result[i].file_serial]);
            let loc = arr2.indexOf(result[i].file_serial);
            if (loc === -1){this.logger.error('restorefiles: ' + result[i].file_serial);continue;}
            arr2.splice(loc,1);
            retArr.push(...arr.splice(loc,1));
        }
        return {arr: retArr, arrFail: arr, namechange};
    }

    // important!
    // mark shouldn't be used by restore mechanism. it is used by sharecopy.
    private async restoreFiles_mark(conn: PoolConnection, userSer: number, arr_: Array<number>){
        let arr =  arr_.slice();
        let str1 = `update recycle set to_restore='true' where user_serial=? and file_serial in ? `;
        let str2 = `update recycle set to_restore='true' where user_serial=? and parent_serial in ? and del_type='recursive' `;
        let str3 = `select file_serial from recycle where user_serial=? and parent_serial in ? and type='dir' and del_type='reucrsive' `;
        str3 += 'for update';
        await conn.execute<RowDataPacket[]>(str1, [userSer, arr]);
        let result: RowDataPacket[];
        while (arr.length > 0) {
            await conn.execute<RowDataPacket[]>(str2, [userSer, arr]);
            [result] = await conn.execute<RowDataPacket[]>(str3, [userSer, arr]);
            arr = result.map((val)=>val.file_serial);
        }
    }

    // important!
    // mark shouldn't be used by restore mechanism. it is used by sharecopy.
    private async restoreFiles_moveFile(conn: PoolConnection, userSer: number){
        let str1 = `insert into file (user_serial, parent_serial, type, file_name, file_serial, last_modified) `;
        str1 += `select user_serial, parent_serial, type, file_name, file_serial, last_modified from recycle `;
        str1 += `where user_serial=? and to_restore='true' `;
        // str1 += 'for update';
        await conn.execute<RowDataPacket[]>(str1, [userSer]);
        str1 = `delete from recycle `;
        str1 += `where user_serial=? and to_restore='true' `;
        await conn.execute<RowDataPacket[]>(str1, [userSer]);
    }

    async restoreFiles(conn: PoolConnection, userSer: number, arr_: FileIdentReqDto[]){
        // create path. check if file already exists there. then get the appropriate name to add
        // important!
        // mark shouldn't be used by restore mechanism. it is used by sharecopy.
        let { arr, arrFail, namechange } = await this.restoreFiles_checkPath(conn, userSer, arr_);
        let clash_toolong = (arrFail.length > 0);
        await this.restoreFiles_mark(conn, userSer, arr.map((val)=>val.id));
        await this.restoreFiles_moveFile(conn, userSer);

        return {arr, arrFail, clash_toolong, namechange};
    }

    private async shareCopy_createFile(conn: PoolConnection, userSer: number, files: FileIdentReqDto[], friends: number[]){
        // note: users can share file that are read/edit shared from others.
        // the validity of sender's access is checked beforehand, and shouldn't be checked here
        // clean 'mark' columns
        await conn.execute(`update recycle set mark='false' where mark='true' and user_serial in ?`, [[1, ...friends]]);
        await conn.execute(`update file set mark='false' where user_serial=? and mark='true'`, [userSer]);
        // insert into file to get file_serials
        let cte = `(select 1 union all select num+1 from cte where num<?) `;
        let str1 = `with recursive cte (num) as `;
        str1 += cte;
        let subt = '(user_serial, parent_serial, type, file_name, mark)';
        str1 += `insert into file ${subt} select ?, 1, 'dir', concat(? ,num), 'true' from cte `;
        await conn.execute(str1, [files.length * friends.length, userSer, userSer + '-']);
        // retrieve the created file_serials
        let [result] = await conn.execute<RowDataPacket[]>(
            `select file_serial from file where user_serial=? and parent_serial=1 and mark='true'`);
        // put the files into 'recycle' table
        subt = '(user_serial, parent_serial, parent_path, type, file_name, file_serial, last_modified, del_type, mark)';
        str1 = `with recursive cte (num) as ${cte} insert into recycle ${subt} `;
        str1 += `select 1, 1, 'files/inbox', 'file', tfile.fname, tser.file_serial, tfile.last_modified, 'recursive', 'true' `;
        str1 += `from (select file_name, last_modified, row_number() over() as rownum from file cross join cte `;
        str1 += `where file_serial in ? for share) as tfile inner join `;
        str1 += `(select file_serial, row_number() over() as rownum from file `;
        str1 += `where user_serial=? and parent_serial=1 and mark='true') as tser using (rownum) `;
        await conn.execute(
            str1, [friends.length, userSer, files.map(val=>val.id), userSer]
        );
        // update the recycle table with proper user_serials, but without parent directory set as it isn't really used
        str1 = `with recursive cte (num) as ${cte} `;
        str1 += `update (select user_serial, mark, row_number() over() as rownum `;
        str1 += `from recycle where user_serial=1 and mark='true' order by file_name for update) as trec cross join `;
        str1 += `(select user_serial_to, nickname, num, row_number() over() as rownum `;
        str1 += `from shared_def cross join cte `;
        str1 += `where user_serial_from=? and user_serial_to in ? order by num for share) as tser using (rownum) `;
        str1 += `set trec.user_serial=tser.user_serial_to, trec.file_name=left(concat(tser.nickname,' - ',trec.file_name),40) `;
        await conn.execute(str1, [files.length, userSer, friends]);
        // delete the created files in 'file' table
        await conn.execute(`delete from file where user_serial=? and parent_serial=1 and mark='true'`, [userSer]);
        // note that mark in recycle is left as true for future use here.
    }

    private async shareCopy_restore(conn: PoolConnection, userSer: number, files: FileIdentReqDto[], friends: number[]){
        // check for name collisoins first! first move all to recycle, and reuse the recovery algorithm
        let [result] = await conn.execute<RowDataPacket[]>(
            // intentionally not 'for share', for efficiency
            `select user_serial from user where user_serial in ? and auto_receive_files='true' `, [friends]
        );
        let arrFail: FileIdentResDto[] = [];
        let str1 = `select file_serial, last_renamed from recycle `;
        str1 += `where user_serial=? and parent_serial=1 and mark='true' for update`; // mark shouldn't be used by restore mechanism
        for (let i = 0; i < result.length; i++){
            let [resFile] = await conn.execute<RowDataPacket[]>(
                str1, [result[i].user_serial]
            );
            let res = await this.restoreFiles(conn, result[i].user_serial, resFile.map(val=>{return {id: val.file_serial, timestamp: val.last_renamed};}));
            arrFail = arrFail.concat(res.arrFail.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};}));
        }
        await conn.execute(`update recycle set mark='false' where mark='true' and user_serial in ?`);

        return arrFail;
    }

    async shareCopy(conn: PoolConnection, userSer: number, files: FileIdentReqDto[], friends: number[]){
        // for sharecopy, only files that user owns can be shared, as shared_def depends on friend_mono
        let retVal = new FileShareResDto();
        retVal.addarr = []; // always empty as the result shouldn't really be visible to sender in copy mode
        retVal.failed = [];
        if (files.length * friends.length > 800){
            retVal.failed = files.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
            retVal.failreason = '복사 방식으로는 (전송 파일 개수)x(전송 인원)이 800을 초과할 수 없습니다.';
            return retVal;
        }
        // move to recycle
        // items are left mark='true' in recycle, for future use.
        await this.shareCopy_createFile(conn, userSer, files, friends);
        // then restore if the receiver turned restore on.
        retVal.failed = await this.shareCopy_restore(conn, userSer, files, friends);
        return retVal;
    }

    async shareReadEdit(conn: PoolConnection, userSer: number, files: number[], friends: number[], edit: boolean){
        let retVal = new FileShareResDto();
        retVal.addarr = [];
        retVal.failed = [];
        let shareType = edit ? 'edit' : 'read';
        // check for already shared files first
        await conn.execute(`update shard_def set mark='false' where user_serial_from=? and mark='true'`, [userSer]);
        let subt = '(user_serial_to, user_serial_from, file_serial, file_name, share_type, mark)';
        let str1 = `insert into shared_def ${subt} select fm.user_serial_to, fm.user_serial_from, file.file_serial, file.file_name, ?, 'true' `;
        str1 += `from friend_mono as fm cross join file `;
        str1 += `where friend_mono.user_serial_from=? and friend_mono.user_serial_to in ? and file.user_serial=? and file.file_serial in ? `;
        str1 += `on duplicate key update share_type=?` // marked true only for new inserts
        await conn.execute(
            str1, [shareType, userSer, friends, userSer, files, shareType]
        );
        str1 = `select type, file_name, file.bookmarked as bookmarked, last_modified, file_serial, last_renamed `;
        str1 += `from shared_def inner join file using (file_serial) `;
        str1 += `where user_serial_from=? and mark='true' for update `
        let [result] = await conn.execute<RowDataPacket[]>(str1, [userSer]);
        retVal.addarr = result.map(val=>{
            return {
                link: val.type==='dir' ? `/files?dirid=${val.file_serial}` : `/edit?id=${val.file_serial}`,
                id: val.file_serial,
                isFolder: val.type==='dir',
                text: val.file_name,
                bookmarked: val.bookmarked==='true',
                shared: '', // temporary. added with this.addSharedNames
                date: val.last_modified.toISOString(),
                ownerImg: '/images/user',
                timestamp: val.last_renamed.toISOString()
            }
        });
        await conn.execute(`update shard_def set mark='false' where user_serial_from=? and mark='true'`, [userSer]);
        await this.addSharedNames(retVal.addarr);
        await this.replaceNames(userSer, retVal.addarr);
        return retVal;
    }
    
    // called from the receiver (with only the file numbers)
    // or the sender (with a single file number and multiple friends)
    async removeShare(conn: PoolConnection, userSer: number, files: FileIdentReqDto[], friends?: number[]){
        let retVal = new FileDelResDto();
        retVal.failed = [];
        retVal.delarr = [];
        let filearr = files.map(val=>val.id);
        if (friends === undefined){ // from the receiver
            await conn.execute(
                `delete from shared_def where user_serial_to=? and file_serial in ? `,
                [userSer, filearr]
            );
            retVal.delarr = files.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
        } else { // from the sender
            if (files.length !== 1){throw new BadRequestException();}
            await conn.execute(
                `delete from shared_def where user_serial_from=? and user_serial_to in ? and file_serial=?`,
                [userSer, friends, files[0].id]
            );
        }
        return retVal;
    }

    async addShare(conn: PoolConnection, userSer: number, files: FileIdentReqDto[], friends: number[], mode: "copy" | "read" | "edit"){
        let retVal = new FileShareResDto();
        retVal.addarr = [];
        retVal.failed = [];
        let filearr = files.map(val=>val.id);
        if (mode === 'copy'){
            retVal = await this.shareCopy(conn, userSer, files, friends);
        } else {
            let [result] = await conn.execute<RowDataPacket[]>(
                `select file_serial from file where user_serial=? and file_serial in ?`, [userSer, filearr]
            );
            if (result.length < files.length){
                retVal.failed = files.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
                retVal.failreason = '사본 공유 이외의 공유는 소유한 파일에 대해서만 가능합니다.';
                return retVal;
            }
            retVal = await this.shareReadEdit(conn, userSer, filearr, friends, mode === 'edit');
        }
        return retVal;
    }

    async removeBookmark(conn: PoolConnection, userSer: number, files: FileIdentReqDto[]){
        let retVal = new FileDelResDto();
        retVal.delarr = [];
        retVal.failed = [];
        // consider both own files and external files
        let filelist = files.map<[number, Date]>(val=>[val.id, val.timestamp]);
        let [result] = await conn.execute<ResultSetHeader>(
            `update file set bookmarked='false' where user_serial=? and (file_serial, last_renamed) in ? `, [userSer, filelist]
        );
        let subq = `select file_serial from file where (file_serial, last_renamed) in ? for share`;
        let [result2] = await conn.execute<ResultSetHeader>(
            `update shared_def set bookmarked='false' where user_serial_to=? and file_serial in (${subq}) `, [userSer, filelist]
        );
        if (result.affectedRows + result2.affectedRows >= files.length){
            retVal.delarr = files.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
            return retVal;
        } else {
            let [result] = await conn.execute<RowDataPacket[]>(
                `select file_serial, last_renamed from file where user_serial=? and bookmarked='false' and (file_serial, last_renamed) in ? for share`,
                [userSer, filelist]
            );
            let mapFiles = new Map(filelist);
            for (let i = 0; i < result.length; i++){
                mapFiles.delete(result[i].file_serial);
                retVal.delarr.push({id: result[i].file_serial, timestamp: result[i].last_renamed});
            }
            let str1 = `select file_serial, last_renamed from shared_def inner join file on (file_serial) `;
            str1 += `where user_serial_to=? and bookmarked='false' and (file_serial, last_renamed) in (${subq}) for share`;
            [result] = await conn.execute<RowDataPacket[]>(
                str1, [userSer, filelist]
            );
            for (let i = 0; i < result.length; i++){
                mapFiles.delete(result[i].file_serial);
                retVal.delarr.push({id: result[i].file_serial, timestamp: result[i].last_renamed});
            }
            retVal.failed = Array.from(mapFiles, val=>{return{id: val[0], timestamp: val[1].toISOString()};});
        }
        return retVal;
    }

    async addBookmark(conn: PoolConnection, userSer: number, files: FileIdentReqDto[]){
        let retVal = new FileDelResDto();
        retVal.delarr = [];
        retVal.failed = [];
        // consider both own files and external files
        let filelist = files.map<[number, Date]>(val=>[val.id, val.timestamp]);
        let [result] = await conn.execute<ResultSetHeader>(
            `update file set bookmarked='true' where user_serial=? and (file_serial, last_renamed) in ? `, [userSer, filelist]
        );
        let subq = `select file_serial from file where (file_serial, last_renamed) in ? for share`;
        let [result2] = await conn.execute<ResultSetHeader>(
            `update shared_def set bookmarked='true' where user_serial_to=? and file_serial in (${subq}) `, [userSer, filelist]
        );
        if (result.affectedRows + result2.affectedRows >= files.length){
            return retVal;
        } else {
            let [result] = await conn.execute<RowDataPacket[]>(
                `select file_serial from file where user_serial=? and bookmarked='true' and (file_serial, last_renamed) in ? for share`,
                [userSer, filelist]
            );
            let mapFiles = new Map(filelist);
            for (let i = 0; i < result.length; i++){
                mapFiles.delete(result[i].file_serial);
            }
            [result] = await conn.execute<RowDataPacket[]>(
                `select file_serial from shared_def where user_serial_to=? and bookmarked='true' and (file_serial, last_renamed) in (${subq}) for share`,
                [userSer, filelist]
            );
            for (let i = 0; i < result.length; i++){
                mapFiles.delete(result[i].file_serial);
            }
            retVal.failed = Array.from(mapFiles, val=>{return{id: val[0], timestamp: val[1].toISOString()};});
        }
        return retVal;
    }

    async createFile(conn: PoolConnection, userSer: number, parent: number, name: string){
        if (name.length <= 0) {throw new BadRequestException();}
        if (name.length > 40) {throw new BadRequestException();}
        let retVal = new FileNewResDto();
        retVal.arr = [];
        if (!await this.checkAccess(conn, userSer, parent, 'dir', 'fileonly')){
            throw new BadRequestException();
        }
        let [result2] = await conn.execute<RowDataPacket[]>(
            `select file_serial from file where user_serial=? and parent_serial=? and type='file' and file_name=? for update `,
            [userSer, parent, name]
        );
        if (result2.length > 0){
            retVal.alreadyExists = true;
            return retVal;
        }
        let subt = '(user_serial, parent_serial, type, file_name)';
        let str1 = `insert into file ${subt} value (?, ?, 'file', ?)`;
        let [result] = await conn.execute<ResultSetHeader>(str1, [userSer, parent, name]);
        if (result.insertId <= 0) {
            this.logger.error(`createFile error: insertId<=0 for id:${userSer} dir:${parent} name:${name}`);
            throw new InternalServerErrorException();
        }
        [result2] = await conn.execute<RowDataPacket[]>(`select * from file where file_serial=?`, [result.insertId]);
        if (result2.length <= 0){
            this.logger.error(`createFile error: none found for id:${userSer} dir:${parent} name:${name} insertId: ${result.insertId}`);
            throw new InternalServerErrorException();
        }
        retVal.arr = [{
            link: `/edit?id=${result.insertId}`,
            id: result.insertId,
            isFolder: false,
            text: name,
            bookmarked: false,
            shared: '',
            date: result2[0].last_modified.toISOString(),
            ownerImg: '/images/user',
            timestamp: result2[0].last_renamed.toISOString()
        }]
        return retVal;
    }

    async createDir(conn: PoolConnection, userSer: number, parent: number, name: string){
        if (name.length <= 0) {throw new BadRequestException();}
        if (name.length > 40) {throw new BadRequestException();}
        let retVal = new FileNewResDto();
        retVal.arr = [];
        if(!await this.checkAccess(conn, userSer, parent, 'dir', 'fileonly')){
            throw new BadRequestException();
        }
        let [result2] = await conn.execute<RowDataPacket[]>(
            `select file_serial from file where user_serial=? and parent_serial=? and type='dir' and file_name=? for update `,
            [userSer, parent, name]
        );
        if (result2.length > 0){
            retVal.alreadyExists = true;
            return retVal;
        }
        let subt = '(user_serial, parent_serial, type, file_name)';
        let str1 = `insert into file ${subt} value (?, ?, 'dir', ?)`;
        let [result] = await conn.execute<ResultSetHeader>(str1, [userSer, parent, name]);
        if (result.insertId <= 0) {
            this.logger.error(`createFile error: insertId<=0 for id:${userSer} dir:${parent} name:${name}`);
            throw new InternalServerErrorException();
        }
        [result2] = await conn.execute<RowDataPacket[]>(`select * from file where file_serial=?`, [result.insertId]);
        if (result2.length <= 0){
            this.logger.error(`createFile error: none found for id:${userSer} dir:${parent} name:${name} insertId: ${result.insertId}`);
            throw new InternalServerErrorException();
        }
        retVal.arr = [{
            link: `/files?dirid=${result.insertId}`,
            id: result.insertId,
            isFolder: false,
            text: name,
            bookmarked: false,
            shared: '',
            date: result2[0].last_modified.toISOString(),
            ownerImg: '/images/user',
            timestamp: result2[0].last_renamed.toISOString()
        }]
        return retVal;
    }

    async renameFile(conn: PoolConnection, userSer: number, parent: number, file: number, timestamp: Date, name: string){
        if (name.length <= 0) {throw new BadRequestException();}
        if (name.length > 40) {throw new BadRequestException();}
        let retVal = new FileMoveResDto();
        retVal.addarr = [];
        retVal.delarr = [];
        if (!await this.checkAccess(conn, userSer, parent, 'dir', 'fileonly')){
            throw new BadRequestException();
        }
        // validate timestamp and get file type
        let [result] = await conn.execute<RowDataPacket[]>(
            `select type from file where user_serial=? and parent_serial=? and file_serial=? and last_renamed=? for update `,
            [userSer, parent, file, timestamp]
        );
        // if expired
        if (result.length <= 0){
            retVal.expired = true;
            retVal.failed = [[file, timestamp.toISOString()]];
            return retVal;
        }
        // if already exists
        [result] = await conn.execute<RowDataPacket[]>(
            `select type from file where user_serial=? and parent_serial=? and type=? and file_name=? for update `,
            [userSer, parent, result[0].type, name]
        );
        if (result.length > 0){
            retVal.alreadyExists = true;
            retVal.failed = [[file, timestamp.toISOString()]];
            return retVal;
        }
        await conn.execute(
            `update file set file_name=? where user_serial=? and file_serial=?`, [name, userSer, file]
        );
        await conn.execute(
            `update shared_def set file_name=? where user_serial_from=? and file_serial=?`, [name, userSer, file]
        );
        [result] = await conn.execute<RowDataPacket[]>(
            `select * from file where user_serial=? and file_serial=? for share`, [userSer, file]
        );
        let [result2] = await conn.execute<RowDataPacket[]>(
            `select user_serial_to from shared_def where user_serial_from=? and file_serial=?`,
            [userSer, file]
        );
        retVal.delarr = [{id: file, timestamp: timestamp.toISOString()}];
        retVal.addarr.push({
            link: `/files?dirid=${file}`,
            id: file,
            isFolder: false,
            text: name,
            bookmarked: false,
            shared: result2.map(val=>val.user_serial_to).join(','),
            date: result[0].last_modified.toISOString(),
            ownerImg: '/images/user',
            timestamp: result[0].last_renamed.toISOString()
        });
        await this.replaceNames(userSer, retVal.addarr);
        return retVal;
    }

    async resolveBefore<T extends {id: number, before?: FileIdentResDto}>(
        userSer: number, sort: SortModeDto, files_: readonly T[],
        mode: 'files'|'profile', parent?: number, friend?: number
    ){
        let mapRes = new Map<number, FileIdentResDto>();
        let files = files_.slice();
        let filearr = files.map(val=>val.id);
        await this.mysqlService.doQuery('resolvelbefore', async (conn)=>{
            if (mode === 'files' && parent === undefined){throw new BadRequestException();}
            if (mode === 'profile' && friend === undefined){throw new BadRequestException();}
            let orderby = `order by type ${sort.incr ? 'asc' : 'desc'}, `
            orderby += `${this.translateColumnBase(sort.criteria, 'files').join(' ' + (sort.incr ? 'asc' : 'desc') + ', ')} ${sort.incr ? 'asc' : 'desc'}`;
            let source: string;
            let arrParam: Array<number|string|Date|number[]>;
            if (mode === 'files'){
                source = `from file where user_serial=? and parent_serial=? `;
                arrParam = [userSer, parent!, filearr];
            } else if (mode === 'profile'){
                source = `from (select file_serial from shared_def where user_serial_from=? and user_serial_to=?) union `;
                source += `(select file_serial from shared_def where user_serial_from=? and user_serial_to=?) as shared_def`;
                source += `inner join file using (file_serial)`;
                arrParam = [userSer, friend!, friend!, userSer, filearr]
            } else {throw new BadRequestException();}
            let str1 = `select lead(file_serial, 1, 0) over(${orderby}) as pserial, lead(last_renamed, 1) over(${orderby}) as ptime, file_serial `;
            str1 += source;
            str1 += `where file_serial in ? `;
            let [result] = await conn.execute<RowDataPacket[]>(
                str1, arrParam
            );
            for (let i = 0; i < result.length; i++){
                if (result[i].pserial === 0){continue;}
                mapRes.set(result[i].file_serial, {id: result[i].pserial, timestamp: result[i].ptime.toISOString()});
            }
        });
        for (let i = 0; i < files.length; i++){
            files[i].before = mapRes.get(files[i].id);
        }
        return files;
    }

    async signupCreateDir(conn: PoolConnection, user_serial: number){
        await conn.execute<RowDataPacket[]>(
            `insert into file (user_serial, parent_serial, type, issys, file_name)
            value (?, 1, 'dir', 'true', 'files')`, [user_serial]
        );
        await conn.execute<RowDataPacket[]>(
            'update file set parent_serial=file_serial where user_serial=?', [user_serial]
        );
        let [result] = await conn.execute<RowDataPacket[]>(
            `select file_serial from file where user_serial=? and file_name='files' for share`, [user_serial]
        );
        await conn.execute<RowDataPacket[]>(
            `insert into file (user_serial, parent_serial, type, issys, file_name)
            values (?, ?, 'dir', 'true', 'bookmarks'), (?, ?, 'dir', 'true', 'inbox'),
            (?, ?, 'dir', 'true', 'shared'), (?, ?, 'dir', 'true', 'recycle')`,
            Array(4).fill([user_serial, result[0].file_serial])
        );
    }

    async clearSessions(conn: PoolConnection, userSer: number){
        await conn.execute<RowDataPacket[]>(
            `delete from session where user_serial=?`, [userSer]);
    }

    async clearRecycles(conn: PoolConnection, userSer: number){
        await conn.execute<RowDataPacket[]>(
            `delete from recycle where user_serial=?`, [userSer]);
    }

    async clearGoogle(conn: PoolConnection, userSer: number){
        await conn.execute<RowDataPacket[]>(
            `delete from user_google where user_serial=?`, [userSer]);
    }

    async delUser(conn: PoolConnection, userSer: number){
        // re-remove all friends
        // re-remove all sessions
        // remove all files
        // remove all recycles
        // add to old_id
        // remove google
    }

    async preDelUser(conn: PoolConnection, userSer: number){
        // remove all friends - a separate transaction
        // remove all sessions
    }
}
