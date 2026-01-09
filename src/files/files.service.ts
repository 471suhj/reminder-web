import { BadRequestException, Injectable, InternalServerErrorException, Logger, Res } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import mysql, { RowDataPacket, Pool, PoolConnection, ResultSetHeader, Connection } from 'mysql2/promise';
import { FilesGetResDto } from './files-get-res.dto';
import { PrefsService } from 'src/prefs/prefs.service';
import { SysdirType } from './sysdir.type';
import { FileDelResDto } from './file-del-res.dto';
import { FileIdentResDto } from './file-ident-res.dto';
import { FileIdentReqDto } from './file-ident-req.dto';
import { FilesArrResDto } from './files-arr-res.dto';
import { FileShareResDto } from './file-share-res.dto';
import { FileMoveResDto } from './file-move-res.dto';
import { SortModeDto } from './sort-mode.dto';
import { DataSource, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual } from 'typeorm';
import type { FindOptionsWhere, FindOptionsOrder } from 'typeorm';
import { Efile } from 'src/mysql/file.entity';
import { FilesMoreDto } from './files-more.dto';
import { Ebookmark } from '../mysql/bookmark.entity';
import { Eshared_def } from 'src/mysql/shared_def.entity';
import { Erecycle } from 'src/mysql/recycle.entity';
import { FriendMoreDto } from './friend-more.dto';
import { Efriend_mul } from 'src/mysql/friend_mul.entity';
import { MongoService } from 'src/mongo/mongo.service';
import { ShareHardNotifDto } from 'src/home/share-hard-notif.dto';
import { NotifColDto } from 'src/mongo/notif-col.dto';
import { ShareCopyNotifDto } from 'src/home/share-copy-notif.dto';
import { FiledatColDto } from 'src/mongo/filedat-col.dto';
import { Document, OptionalId } from 'mongodb';
import { Readable } from 'node:stream';
import fs, { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { UnshareNotifDto } from 'src/home/unshare-notif.dto';

@Injectable()
export class FilesService {
    constructor(private readonly mysqlService: MysqlService, private readonly prefsService: PrefsService,
        private readonly dataSource: DataSource, private readonly mongoService: MongoService){}

    private readonly logger = new Logger(FilesService.name);

    // should not be blocking or blocked
    async getUserRoot(userSer: number, type: SysdirType['val']){
        const pool: Pool = await this.mysqlService.getSQL();
        if (!SysdirType.arr.includes(type)){
            throw new InternalServerErrorException();
        }
        let [result] = await pool.execute<RowDataPacket[]>(
            `select file_serial from file where user_serial=? and issys='true' and file_name='${type}'`, [userSer]);
        if (result.length <= 0){
            throw new Error('files service mysql: root folder cannot be found userid=' + userSer);
        }
        return Number(result[0].file_serial);
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
                await conn.query<RowDataPacket[]>(
                    `insert into file (user_serial, parent_serial, type, file_name) value (?)`,
                    [[userSer, dirid, 'dir', arrName[level]]]
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

    // parentId includes itself
    // includes user verification
    async getDirInfo(conn: Connection, userSer: number, fileId: number)
    : Promise<{path: string, pathHtml: string, parentId: number, dirName: string, lastRenamed: Date, arrParentId: number[], issys: boolean}>{
        let path = '';
        let pathHtml = '';
        let parentId = 0;
        let dirName = '';
        let lastRenamed!: Date;
        let arrParentId: number[] = [fileId];
        let issys = false;

        let cont = true;
        let result: RowDataPacket[];
        let curId = fileId;
        let firstReq = true;
        while (cont){
            [result] = await conn.execute<RowDataPacket[]>( // for repeatable read
                'select parent_serial, file_name, last_renamed, issys from file where user_serial=? and file_serial=? for share', [userSer, curId]);
            if (result.length <= 0) {
                if (firstReq){
                    throw new BadRequestException();
                } else {
                    throw new Error('result is empty');
                }
            }
            if (firstReq){
                parentId = Number(result[0].parent_serial === 1 ? fileId : result[0].parent_serial);
                dirName = String(result[0].file_name);
                lastRenamed = result[0].last_renamed;
                issys = result[0].issys === 'true';
            }
            path = result[0].file_name + path;
            pathHtml = `<a class="addrLink" href="/files?dirid=${curId}">${result[0].file_name}</a>`+ pathHtml;
            if (Number(result[0].parent_serial) === 1){
                cont = false;
            } else {
                path = '/' + path;
                pathHtml = '/' + pathHtml;
                curId = Number(result[0].parent_serial);
                firstReq = false;
                arrParentId.push(result[0].parent_serial);
            }
        }
        return {path, pathHtml, parentId, dirName, lastRenamed, arrParentId, issys};
    }

    // if mode is not sepcified, check both dir and files
    // default for lock: true
    async checkTimestamp(conn: Connection, userSer: number, fileSer: number, time: Date, mode?: 'dir'|'file', lock: boolean = true){
        let str1 = `select file_serial from file where user_serial=? and file_serial=? and last_renamed=? `
        if (mode === 'dir'){
            str1 += `and type='dir' `;
        } else if (mode === 'file'){
            str1 += `and type<>'dir' `;
        }
        if (lock !== false) {
            str1 += 'for share';
        }
        let [result] = await conn.execute<RowDataPacket[]>(
            str1, [userSer, fileSer, time]
        );
        return (result.length > 0);
    }

    // default: lock: true
    async checkAccess(conn: Connection, userSer: number, fileSer: number, mode?: 'dir'|'file', nosys?: 'true'|'fileonly', lock: boolean = true){
        let str1 = `select file_serial from file where user_serial=? and file_serial=? `;
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
        if (lock !== false) { // default lock is true
            str1 += 'for share';
        }
        let [result] = await conn.execute<RowDataPacket[]>(
            str1,
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

    async copyMongo(arrAdded: {id: number, origin: number}[]){
        let limit = Math.ceil(arrAdded.length / 80);
        const mapOrig = new Map(arrAdded.map(val=>[val.origin, val.id]));
        const arrOrig = Array.from(mapOrig.keys());
        const coll = await this.mongoService.getDb().collection('file_data');
        let arrDocs: Document[] = [];
        for (let i = 0; i < limit; i++){
            const cur = coll.find({serial: {$in: arrOrig.slice(80 * i, 80 * (i + 1))}}).project({_id: 0});
            const arrRet = await cur.toArray();
            cur.close();
            for (let j = 0; j < arrRet.length; j++){
                arrRet[j].serial = mapOrig.get(arrRet[j].serial);
            }
            arrDocs = arrDocs.concat(arrRet);
        }
        for (const itm of arrAdded){
            try{
                await fs.cp(join(__dirname, `../../filesys/${itm.origin}`), join(__dirname, `../../filesys/${itm.id}`), {errorOnExist: true, force: false, recursive: true});
            } catch (err) {
                console.log(err);
            }
        }
        if (arrDocs.length > 0){
            await coll.insertMany(arrDocs);
        }
    }

    private async processFileStream(doc: FiledatColDto, arr: string[], tmpVar: {buf: string, phase: string, idx: number, fh: null|FileHandle}, pth: string){
        const availProp = ['FontSize', 'Interval', 'RemStart', 'RemEnd'];
        let newbuf = '';
        let commit = async ()=>{
            if (newbuf === ''){ // A: end phase. note that two consequent '' may arrive.
                switch (tmpVar.phase){
                    case '':
                        break;
                    case 'M':
                        break;
                    case 'P':
                        let pairVal = tmpVar.buf.split('=');
                        if (pairVal.length > 0){
                            if (!availProp.includes(pairVal[0])){
                                throw new BadRequestException();
                            }
                            doc.metadata[pairVal.shift()!] = pairVal.join('=');
                        }
                        break;
                    case 'N':
                        if (tmpVar.fh === null){
                            throw new InternalServerErrorException();
                        }
                        await tmpVar.fh.appendFile(tmpVar.buf);
                        await tmpVar.fh.close();
                        tmpVar.fh = null;
                        // push tmpVar.buf, then close the fs.
                        break;
                    default: 
                        throw new BadRequestException();
                }
                tmpVar.phase = '';
                tmpVar.buf = '';
                return;
            }
            if (tmpVar.phase === ''){ // B: start a new phase (no pushing to the buf. step B includes step C.)
                tmpVar.phase = newbuf.slice(0, 1);
                newbuf = newbuf.slice(1);
                tmpVar.buf = '';
                switch (tmpVar.phase){
                    case 'N':
                        tmpVar.fh = await fs.open(join(pth, String(++(tmpVar.idx))), 'wx');
                        doc.arrlen = tmpVar.idx;
                        break;
                }
            }
            // C: continue the phase
            switch (tmpVar.phase){
                case 'M':
                    tmpVar.buf = '';
                    break;
                case 'P':
                    tmpVar.buf += newbuf;
                    if (tmpVar.buf.length > 100){
                        throw new BadRequestException();
                    }
                    break;
                case 'N':
                    if (tmpVar.fh === null){
                        throw new InternalServerErrorException();
                    }
                    await tmpVar.fh.appendFile(tmpVar.buf + newbuf);
                    tmpVar.buf = '';
                    break;
                default: 
                    throw new BadRequestException();
            }
        }
        if (arr.length <= 0){ // empty array is passed only after all the contents are read
            newbuf = '';
            commit();
            return;
        }
        for (let i = 0; i < arr.length; i++){
            let str = arr[i];
            // newbuf: fill the new content
            // buf: store previous value if needed
            // after each 'complete' value, send '' to mark an end
            // consider 4 cases: ['...', '...&N...'], ['...', '...&A...'], ['...', '&A...'], ['...', '&N...']
            // the other 2 cases are prevented in advance: ['...&', 'A...'], ['...&', 'N...']
            if (str.slice(0, 1) === 'A'){
                tmpVar.buf += '&';
                tmpVar.buf += str.slice(1);
            } else if (str === ''){ // to deal with: ['...', '&A...']
                continue;
            } else { // delete ''
                if (i !== 0){
                    newbuf = '';
                    await commit();
                }
                newbuf = str;
                await commit();
            }
        }
    }

    async uploadMongo(fileSer: number, stream: Readable, userSer: number){
        const availVer = ['0.2', '0.3'];
        let buf = '';
        let streamDone = false;
        let finishCalled = false;
        let asyncErr: Error|null = null;
        let objDoc = new FiledatColDto();
        objDoc.serial = fileSer;
        objDoc.user_serial = userSer;
        const tmpVar = {buf: '', phase: 'M', idx: 0, fh: null};
        const dirpath = join(__dirname, `../../filesys/${fileSer}`);
        await fs.mkdir(dirpath, {});

        let inspected = false;
        // make sure that no errors are thrown
        stream.on('readable', async ()=>{
            if (asyncErr !== null){stream.resume(); return;} // so that readable will not be called unneccessarily
            try{
                streamDone = false;
                let chunk: Buffer;
                while ((chunk = stream.read()) !== null){
                    // buf: at first, store all data to validate 'AAMPGRMB'
                    // after validation, mostly empty, used to prevent sending arrays ending in ''
                    buf += chunk.toString();
                    let arrTmp = buf.split('&');
                    buf = arrTmp.at(-1) ?? '';
                    if (!inspected){ // if uninspected either inspect or continue;
                        if (arrTmp.length > 1 || arrTmp[0].length > 17){ // pre-check
                            if (arrTmp[0].slice(1, 17) !== 'AAMPGRMBFileVer='){
                                throw new BadRequestException();
                            }
                        }
                        if (arrTmp.length > 1 || arrTmp[0].length > 30){ // can always be inspected
                            if (availVer.includes(arrTmp[0].slice(17))){ // inspected
                                objDoc.type = 'rmb' + arrTmp[0].slice(17) as typeof objDoc.type;
                                inspected = true; // flow to the next stage
                                arrTmp.shift();
                            } else {
                                throw new BadRequestException();
                            }
                        } else { // length still 1 and uninspected --> continue;
                            return;
                        }
                    }
                    buf = '';
                    if (arrTmp.at(-1) === ''){
                        arrTmp.pop();
                        buf = '&';
                    }
                    await this.processFileStream(objDoc, arrTmp, tmpVar, dirpath);
                }
            } catch (err) {
                this.logger.error('uploadMongo stream error. see below.');
                console.log(err);
                asyncErr = err;
                stream.resume();
            } finally {
                streamDone = true;
            }
        });
        // end and close are run before data event finishes
        stream.on('end', ()=>{
        });
        stream.on('close', ()=>{
            finishCalled = true;
        });
        stream.on('error', (err)=>{
            this.logger.error('uploadMongo stream error. see below.');
            console.log(err);
            stream.resume();
        });
        try{
            while((!finishCalled) || (!streamDone)){
                await new Promise(resolve=>setImmediate(resolve));
            }
            if (asyncErr !== null){
                stream.resume();
                throw asyncErr;
            }
            await this.processFileStream(objDoc, [], tmpVar, dirpath);
            if (objDoc.type === 'rmb0.2' && objDoc.arrlen !== 15){
                objDoc.type = 'rmb0.3';
            }
            await this.mongoService.getDb().collection('file_data').insertOne(objDoc);
        } catch (err) {
            try{
                await fs.rm(dirpath, {force: true, recursive: true});
            } catch (err) {
                console.log(err);
            }
            if (err instanceof BadRequestException){
                throw err;
            } else {
                throw new InternalServerErrorException();
            }
        }
    }

    async renderFilesPage(userSer: number, dirid: number): Promise<FilesGetResDto>{
        let retObj: FilesGetResDto = new FilesGetResDto();
        // includes user verification
        const {path, pathHtml, parentId, dirName, lastRenamed, issys} = await this.getDirInfo(await this.mysqlService.getSQL(), userSer, dirid);
        retObj.countItem = 'false';
        retObj.path = path;
        retObj.uplink = '/files?dirid=' + String(parentId);
        retObj.dirName = issys ? SysdirType.translate(dirName) : dirName;
        retObj.dirPath = pathHtml;
        retObj.dirId = dirid;
        retObj.timestamp = lastRenamed.toISOString();
        retObj = {...retObj, ...(await this.prefsService.getUserCommon(userSer, 'files'))};
        return retObj;
    }

    async renderSharedPage(userSer: number, dirType: SysdirType['val']): Promise<FilesGetResDto>{
        if (!SysdirType.arr.includes(dirType)){
            throw new BadRequestException();
        }
        let retObj: FilesGetResDto = new FilesGetResDto();
        const dirid = await this.getUserRoot(userSer, dirType);

        retObj.countItem = 'false';
        retObj.path = 'files/' + dirType;
        retObj.uplink = '/files';
        retObj.dirName = SysdirType.translate(dirType);
        retObj.dirPath = `<a class="addrLink" href="/files">files</a>/<a class="addrLink" href="/files/${dirType}">${dirType}</a>`;
        retObj.dirId = dirid;
        retObj.timestamp = new Date().toISOString();
        let sideName =  (dirType === 'recycle' || dirType === 'inbox' || dirType === 'upload_tmp') ? 'files' : dirType;
        retObj = {...retObj, ...(await this.prefsService.getUserCommon(userSer, sideName))}; // overwritten
        return retObj;
    }

    async loadFileMore(userSer: number, dir: number, dirDate: Date, lastFile: number, lastTime: Date, sort: SortModeDto){
        let crit = ['type', ...this.translateColumnBase(sort.criteria, 'files')];
        let retVal = new FilesMoreDto();
        retVal.loadMore = true;
        try{
        await this.dataSource.transaction(async manager=>{
            let result = await manager.find(Efile, {
                where: {
                    user_serial: userSer,
                    file_serial: String(dir),
                }
            });
            if (result.length <= 0){
                throw new BadRequestException();
            }
            if (lastFile === 0){
                if (+dirDate !== +(result[0].last_renamed)){
                    retVal.needReload = true;
                    throw new Error('rollback_');
                }
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
                        file_serial: String(lastFile),
                        last_renamed: lastTime
                    }
                });
                if (result.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback_');
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
                id: Number(val.file_serial),
                isFolder: val.type === 'dir',
                text: val.issys === 'true' ? SysdirType.translate(val.file_name) : val.file_name,
                bookmarked: val.bookmarked === 'true',
                shared: val.shares.map(val=>val.user_serial_to).join(','),
                date: (val.last_modified as Date),
                timestamp: val.last_renamed,
            };});
        });
        } catch (err) {
            if (err.message !== 'rollback_'){
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
        await this.dataSource.transaction(async manager=>{
            let whereObj = {
                reader: userSer,
            }
            let wherearr: FindOptionsWhere<Ebookmark>[] = [];
            if (lastFile !== 0){
                let result2 = await manager.find(Efile, {
                    where: [{
                        user_serial: userSer,
                        file_serial: String(lastFile),
                        last_renamed: lastTime
                    },{
                        file_serial: String(lastFile),
                        last_renamed: lastTime,
                        shares: {
                            user_serial_to: userSer
                        }
                    }]
                });
                if (result2.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback_');
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
                id: Number(val.file_serial),
                isFolder: val.type === 'dir',
                text: val.file_name,
                bookmarked: true,
                shared: val.shares.map(val=>val.user_serial_to).join(','),
                date: (val.last_modified as Date),
                ownerImg: '/graphics/profimg?id=' + val.user_serial,
                ownerName: String(val.user_serial),
                timestamp: val.last_renamed,
            };});
        });
        } catch (err) {
            if (err.message !== 'rollback_') {throw err;}
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
        await this.dataSource.transaction(async manager=>{
            let whereObj1 = {
                user_serial_to: userSer,
                user_serial_from: friend,
            };
            let whereObj2 = {
                user_serial_to: friend,
                user_serial_from: userSer,
            };
            let wherearr: FindOptionsWhere<Eshared_def>[] = [];
            let result: Efile[];
            if (lastFile !== 0){
                result = await manager.find(Efile, {
                    relations: {
                        shares: true,
                    },
                    where: {
                        file_serial: String(lastFile),
                        last_renamed: lastTime,
                        shares: {
                            user_serial_to: userSer,
                        },
                        user_serial: friend,
                    }
                });
                if (result.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback_');
                }
                let lenTmp = crit.length;
                let lenTmp_dbl = friend ? lenTmp * 2 : lenTmp;
                for (let k = 0; k < lenTmp_dbl; k++){
                    let i = k % lenTmp;
                    wherearr.push({...((i === k) ? whereObj1 : whereObj2)});
                    let j = 0;
                    wherearr[i].file = {};
                    for (; j < lenTmp - 1 - i; j++){
                        wherearr[i].file![crit[j]] = result[0][crit[j]];
                    }
                    wherearr[i].file![crit[j]] = sort.incr ? MoreThan(result[0][crit[j]]) : LessThan(result[0][crit[j]]);
                }
            } else {
                wherearr = friend ? [whereObj1, whereObj2] : [whereObj1];
            }
            let orderObj = {file: {}};
            for (const itm of crit){
                    orderObj.file[itm] = sort.incr ? "ASC" : "DESC";
            }
            let result2 = await manager.find(Eshared_def, {
                relations: {
                    file: {shares: true},
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
                link: `/edit?id=${val.file_serial}`,
                id: Number(val.file_serial),
                isFolder: val.file.type === 'dir',
                text: val.file_name,
                bookmarked: val.bookmarked === 'true',
                shared: val.file.shares.map(val=>val.user_serial_to).join(','),
                dateShared: val.date_shared,
                date: (val.file.last_modified as Date),
                ownerName: String(val.friend_mono.user_serial_from),
                ownerImg: '/graphics/profimg?id=' + val.user_serial_from,
                timestamp: val.file.last_renamed,
            };});
        });
        } catch (err) {
            if (err.message !== 'rollback_'){throw err;}
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
        await this.dataSource.transaction(async manager=>{
            let whereObj: FindOptionsWhere<Erecycle> = {
                user_serial: userSer,
                del_type: 'direct'
            };
            let wherearr: FindOptionsWhere<Erecycle>[] = [];
            if (lastFile !== 0){
                let result = await manager.find(Erecycle, {
                    where: {
                        user_serial: userSer,
                        file_serial: String(lastFile),
                        last_renamed: lastTime,
                    }
                });
                if (result.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback_');
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
                id: Number(val.file_serial),
                isFolder: val.type === 'dir',
                text: val.file_name,
                date: val.last_modified,
                timestamp: val.last_renamed,
                origPath: val.parent_path,
                dateDeleted: val.last_renamed,
            };});
        });
        } catch (err) {
            if (err.message !== 'rollback_') {throw err;}
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
        await this.dataSource.transaction(async manager=>{
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
                link: '/friends/' + val.user_serial_from,
                profileimg: '/graphics/profimg?id=' + val.user_serial_from,
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
        await this.loadFriendMore_fillInfo(retVal.addarr);
        return retVal;
    }

    private async loadFriendMore_fillInfo(lst: FilesArrResDto['arrFriend']){
        let mapArr = new Map(lst.map(val=>[val.id, val]));
        let arrSerial = lst.map(val=>val.id);
        if (lst.length <= 0){
            return;
        }
        await this.mysqlService.doQuery('files service friendload fillinfo', async (conn)=>{
            let [result] = await conn.query<RowDataPacket[]>(
                `select user_serial, name, user_id from user where user_serial in (?)`, [arrSerial]
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
            [result] = await conn.query<RowDataPacket[]>(
                `select user_serial_from, file_name from shared_def where user_serial_from in (?)`, [arrSerial]
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
        context: 'files'|'bookmarks'|'recycle'|'shared', dirOrFriend?: number, dirDate?: Date
    ){
        if (lst.at(-1)?.id === -1 || lst.at(-1)?.id === 0){
            lst.pop();
        } else {
            return;
        }
        let ret = new FilesMoreDto();
        ret.addarr = [{id: lastfile, timestamp: timestamp, date: new Date(), isFolder: true, text: ''}];
        ret.loadMore = true;
        while (ret.loadMore) {
            const lastitm = ret.addarr.at(-1);
            if (!lastitm){
                break;
            }
            if (context === 'bookmarks'){
                ret =  await this.loadBookmarkMore(userSer, lastitm.id, lastitm.timestamp, sort);
            } else if (context === 'files' && dirOrFriend){
                if (dirDate === undefined){
                    throw new InternalServerErrorException();
                }
                ret = await this.loadFileMore(userSer, dirOrFriend, dirDate, lastitm.id, lastitm.timestamp, sort);
            } else if (context === 'recycle'){
                ret = await this.loadRecycleMore(userSer, lastitm.id, lastitm.timestamp, sort);
            } else if (context === 'shared'){
                ret = await this.loadSharedMore(userSer, lastitm.id, lastitm.timestamp, sort, dirOrFriend);
            } else {throw new BadRequestException();}
    
            lst.push(...ret.addarr.map(val=>{return {id: val.id, timestamp: new Date(val.timestamp)}}));
        }
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

    async resolveBefore<T extends {id: number, before?: FileIdentResDto}>(
        conn: Connection, userSer: number, sort: SortModeDto, files_: readonly T[],
        mode: 'files'|'profile', parent?: number, friend?: number
    ){
        if (files_.length <= 0){
            return files_.slice();
        }
        let mapRes = new Map<number, FileIdentResDto>();
        let files = files_.slice();
        let filearr = files.map(val=>val.id);
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
                source = `from ((select file_serial from shared_def where user_serial_from=? and user_serial_to=?) union `;
                source += `(select file_serial from shared_def where user_serial_from=? and user_serial_to=?)) as shared_def `;
                source += `inner join file using (file_serial)`;
                arrParam = [userSer, friend!, friend!, userSer, filearr]
            } else {throw new BadRequestException();}
            let str1 = `select lead(file_serial, 1, -2) over(${orderby}) as pserial, lead(last_renamed, 1) over(${orderby}) as ptime, file_serial `;
            str1 += source;
            str1 = `select * from (${str1}) as tbl where file_serial in (?) `;
            str1 += 'for share';
            let [result] = await conn.query<RowDataPacket[]>(
                str1, arrParam
            );
            for (let i = 0; i < result.length; i++){
                mapRes.set(result[i].file_serial, {id: Number(result[i].pserial), timestamp: result[i].ptime});
            }
        for (let i = 0; i < files.length; i++){
            files[i].before = mapRes.get(files[i].id);
        }
        return files;
    }

    async replaceNames(userSer: number, lst: FilesArrResDto['arr']){
        let arrnames = new Set([-1]);
        for (const val of lst.map(val=>val.shared)){
            if (val === undefined){continue;}// as all of the shared will actually be undefined.
            for (let itm of val.split(',')){
                if (itm === ''){continue;}
                arrnames.add(Number(itm));
            }
        }
        for (const val of lst.map(val=>val.ownerName)){
            if (val === undefined){continue;}// as all of the shared will actually be undefined.
            if (val === ''){continue;}
            arrnames.add(Number(val));
        }
        if (arrnames.size <= 0){
            return;
        }
        let result: RowDataPacket[] = [];
        await this.mysqlService.doQuery('files service replaceNames', async (conn)=>{
            let str1 = `select user_serial, ifnull(nickname, name) as nickname, name from user left join friend_mono `;
            str1 += `on user.user_serial=friend_mono.user_serial_from and friend_mono.user_serial_to=? `;
            str1 += `where user_serial in (?)`;
            [result] = await conn.query<RowDataPacket[]>(
                str1, [userSer, Array.from(arrnames)]
            );
        });
        let mapnames = new Map<number, string>(result.map(val=>[val.user_serial, val.nickname === '' ? val.name : val.nickname]));
        mapnames.set(userSer, '나');
        for (let i = 0; i < lst.length; i++){
            if (lst[i].shared !== undefined){
                lst[i].shared = lst[i].shared!.split(',').map(val=>mapnames.get(Number(val))).join(', ');
            }
            if (lst[i].ownerName !== undefined){
                lst[i].ownerName = mapnames.get(Number(lst[i].ownerName!));
            }
        }
    }

    async resolveSharedNames(lst: FilesArrResDto['arr'], conn?: Connection, lock?: boolean): Promise<void> {
        if (lst.length <= 0){
            return;
        }
        let str1 = `select file_serial, user_serial_to as id `;
        str1 += `from shared_def where file_serial in (?) `;
        let result: RowDataPacket[] = [];
        if (conn === undefined){
            conn = await this.mysqlService.getSQL();
        } else if (lock) {
            str1 += 'for share';
        }
        [result] = await conn.query<RowDataPacket[]>(
            str1, [lst.map(val=>val.id)]
        );
        let mapFile = new Map(lst.map(val=>[val.id, val]));
        for (const itm of result){
            let obj = mapFile.get(itm.file_serial);
            if (obj === undefined){this.logger.error('resolveSharedNames: object not found for '+itm.file_serial);continue;}
            obj.shared += (itm.id + ',');
        }
        for (const itm of lst){
            itm.shared = itm.shared!.slice(0, -1);
        }
    }
    
    private async deleteFiles_validity(
        conn: PoolConnection, userSer: number, arr_: readonly FileIdentReqDto[]
    ): Promise<{arr: [number, Date][], arrFail: [number, Date][]}> {
        if (arr_.length <= 0){
            return {arr: [], arrFail: []};
        }
        let arr = arr_.slice(0);
        let str1 = `select file_serial as id, last_renamed as timestamp from file `;
        str1 += `where user_serial=? and (file_serial,last_renamed) in (?) `;
        str1 += 'for update';
        let arr2 = arr.map((val)=>(val.timestamp.toISOString() + val.id));
        let retArr: Array<[number, Date]> = [];
        let [result] = await conn.query<RowDataPacket[]>(
            str1, [userSer, arr.map((val)=>[val.id, val.timestamp])]
        );
        for (let i = 0; i < result.length; i++){
            let idxTmp = arr2.indexOf(result[i].timestamp.toISOString() + result[i].id);
            if (idxTmp === -1){continue;}
            arr2.splice(idxTmp, 1);
            let itmTmp = arr.splice(idxTmp, 1)[0];
            retArr.push([itmTmp.id, itmTmp.timestamp]);
        }
        return {arr: retArr, arrFail: arr.map<[number, Date]>((val)=>{return [val.id, val.timestamp];})};
    }

    private async deleteFiles_mark(
        conn: PoolConnection, userSer: number, arr_: readonly [number, Date][]
    ): Promise<{arr: [number, Date][], arrFail: [number, Date][]}> {
        if (arr_.length <= 0){
            return {arr: [], arrFail: []};
        }
        let arr = new Map(arr_);
        let str1 = `update file set to_delete='direct' `;
        str1 += `where user_serial=? and issys='false' and file_serial in (?) `;
        // str1 += 'for update';
        await conn.query<RowDataPacket[]>(
            str1, [userSer, Array.from(arr.keys())]
        );
        str1 = `select file_serial from file `;
        str1 += `where user_serial=? and to_delete='direct' for update `;
        let [result] = await conn.execute<RowDataPacket[]>(
            str1, [userSer]
        );
        let retArr: [number, Date][] = [];
        for (let i = 0; i < result.length; i++){
            let valTmp = arr.get(result[i].file_serial);
            if (valTmp === undefined){this.logger.error('deletefiles_mark: '+result[i].file_serial);continue;}
            retArr.push([result[i].file_serial, valTmp]);
            arr.delete(result[i].file_serial);
        }
        return {arr: retArr, arrFail: Array.from(arr)};
    }

    private async deleteFiles_recurse(conn: PoolConnection, userSer: number, arr_: readonly number[]): Promise<number[]> {
        let arr = arr_.slice();
        if (arr.length <= 0){
            return arr;
        }
        let str1 = `update file set to_delete='recursive' `;
        str1 += `where user_serial=? and issys='false' and parent_serial in (?) `;
        await conn.query(str1, [userSer, arr]);

        str1 = `select file_serial as id from file `;
        str1 += `where user_serial=? and issys='false' and parent_serial in (?) and type='dir' `;
        str1 += 'for update';
        let [result] = await conn.query<RowDataPacket[]>(
            str1, [userSer, arr]
        );
        return result.map((val)=>val.id);
    }

    private async deleteFiles_removeShares(conn: PoolConnection, userSer: number): Promise<void> {
        let subq = `select file_serial from file where user_serial=? and to_delete<>'na' for update`;
        let str1 = `delete from shared_def `;
        str1 += `where user_serial_from=? and file_serial in (${subq}) `;
        // str1 += 'for update';
        await conn.execute<RowDataPacket[]>(
            str1, [userSer, userSer]
        );
    }

    private async deleteFiles_toRecycle(conn: PoolConnection, userSer: number, origPath: string): Promise<void> {
        let str1 = `insert into recycle (user_serial, parent_serial, type, file_name, file_serial, last_modified, del_type, parent_path) `;
        let subq = `user_serial, parent_serial, type, file_name, file_serial, last_modified, to_delete, ?`;
        str1 += `select ${subq} from file where user_serial=? and to_delete<>'na' and issys='false' `;
        // str1 += 'for update';
        await conn.execute<RowDataPacket[]>(
            str1, [origPath, userSer]
        );
    }

    private async deleteFiles_remove(conn: PoolConnection, userSer: number): Promise<void> {
        // remove parent dependency before deleting
        const recDir = await this.getUserRoot(userSer, 'recycle');
        let str1 = `update file set parent_serial=?, file_name=file_serial where user_serial=? and to_delete<>'na' and issys='false'`;
        await conn.execute(str1, [recDir, userSer]);
        str1 = `delete from file `;
        str1 += `where user_serial=? and to_delete<>'na' and issys='false' `;
        // str1 += 'for update';
        await conn.execute(str1, [userSer]);
    }

    async deleteFiles(
        conn: PoolConnection, userSer: number, arr_: readonly FileIdentReqDto[], from: number, rb: {rback: boolean}|'force'
    ): Promise<FileDelResDto>{
        // deleting folders: need recursive action - mark with to_delete
        // also remove shared_def for all recursively deleted ones
        // do not delete sysdirs.
        let arrFail_add: [number, Date][] = [];
        let result;
        let {arr, arrFail} = await this.deleteFiles_validity(conn, userSer, arr_);
        ({arr, arrFail: arrFail_add} = await this.deleteFiles_mark(conn, userSer, arr));
        arrFail.push(...arrFail_add);
        result = arr.map(val=>val[0]);
        while (result.length > 0) {
            result = await this.deleteFiles_recurse(conn, userSer, result);
        }
        await this.deleteFiles_removeShares(conn, userSer);
        const { path } = await this.getDirInfo(conn, userSer, from);
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

    async moveFiles_getName(
        conn: PoolConnection, userSer: number, dirfrom: number, files_: readonly [number, Date][], move: boolean
    ): Promise<{arrValidFiles: Map<number, Date>, arrFail: [number, Date][], arrTypeName: ['file'|'dir', string][]}> {
        if (files_.length <= 0){
            return {arrValidFiles: new Map<number, Date>(), arrFail: [], arrTypeName: []};
        }
        let str1 = `select file_serial, last_renamed, type, file_name from file where user_serial=? and parent_serial=? and (file_serial, last_renamed) in (?) and issys='false' `;
        str1 += (move ? 'for update' : 'for share');
        let [resName] = await conn.query<RowDataPacket[]>(str1, [userSer, dirfrom, files_]);
        let arrLeft = files_.slice();
        let arrString = arrLeft.map(val=>val[1].toISOString() + val[0]);
        let arrValidFiles = new Map<number, Date>();
        for (let i = 0; i < resName.length; i++){
            let idx = arrString.indexOf(resName[i].last_renamed.toISOString() + resName[i].file_serial);
            if (idx === -1){this.logger.error('movefiles_validatefiles: ' + userSer);console.log(resName[i]);continue;}
            arrString.splice(idx, 1);
            let tval = arrLeft.splice(idx, 1)[0];
            arrValidFiles.set(tval[0], tval[1]);
        }
        return {arrValidFiles, arrFail: arrLeft, arrTypeName: resName.map<['file'|'dir', string]>(val=>[val.type as 'file'|'dir', val.file_name])};
    }

    // addarr: not 0 only when copied to the same dir. delarr: not 0 only when del is truthy
    // deals with both move and copy. use 'del' parameter
    async moveFiles_rename(
        conn: PoolConnection, userSer: number, del: boolean, from: number, to: number, arr_: readonly {file_serial: number, file_name: string, type: string, timestamp: Date, modif: Date}[]
    ): Promise<{arrFail: [number, Date][], addarr: FilesArrResDto['arr'], delarr: {id: number, timestamp: string|Date}[]}> {
        if (arr_.length <= 0){
            return {arrFail: [], addarr: [], delarr: []};
        }
        const arrFail: [number, Date][] = [];
        const addarr: FilesArrResDto['arr'] = [];
        const delarr: {id: number, timestamp: Date}[] = [];
        for (let i = 0; i < arr_.length; i++) {
            let newname = arr_[i].file_name;
            if (del) {
                while (true) {
                    const [res] = await conn.execute<RowDataPacket[]>(
                        `select file_serial from file where user_serial=? and parent_serial=? and type=? and file_name=? for share`,
                        [userSer, to, arr_[i].type, newname]
                    );
                    if (res.length > 0) {
                        newname += '-2';
                        if (newname.length > 40) {
                            arrFail.push([arr_[i].file_serial, arr_[i].timestamp]);
                            break;
                        }
                    } else {
                        await conn.execute(`update file set file_name=?, parent_serial=? where file_serial=?`, [newname, to, arr_[i].file_serial]);
                        delarr.push({id: arr_[i].file_serial, timestamp: arr_[i].timestamp});
                        break;
                    }
                }
            } else {
                while (true) {
                    const [res] = await conn.execute<RowDataPacket[]>(
                        `select file_serial from file where user_serial=? and parent_serial=? and type=? and file_name=? for share`,
                        [userSer, to, arr_[i].type, newname]
                    );
                    if (res.length > 0) {
                        newname += '-2';
                        if (newname.length > 40) {
                            arrFail.push([arr_[i].file_serial, arr_[i].timestamp]);
                            break;
                        }
                    } else {
                        const [inputRes] = await conn.query<ResultSetHeader>(
                            `insert into file (user_serial, parent_serial, type, file_name, last_modified, copy_origin) value (?)`,
                            [[userSer, to, arr_[i].type, newname, arr_[i].modif, arr_[i].file_serial]]
                        );
                        const [inputInfo] = await conn.execute<RowDataPacket[]>(`select * from file where file_serial=? for share`, [inputRes.insertId]);
                        if (inputInfo.length <= 0) {
                            this.logger.error('newly inserted file row could not be found');
                            arrFail.push([arr_[i].file_serial, arr_[i].timestamp]);
                        } else {
                            if (from === to) {
                                addarr.push({
                                    date: inputInfo[0].last_modified,
                                    id: inputInfo[0].file_serial,
                                    isFolder: inputInfo[0].type === 'dir',
                                    text: inputInfo[0].file_name,
                                    timestamp: inputInfo[0].last_renamed,
                                    bookmarked: inputInfo[0].bookmarked === 'true',
                                    link: (inputInfo[0].type === 'dir' ? `/files?id=` : `/edit?id=`) + inputInfo[0].file_serial,
                                    ownerImg: '/graphics/profimg',
                                    shared: ''
                                })
                            }
                            break;
                        }
                    }
                }
            }
        }

        return {addarr, arrFail, delarr};
    }

    // in the case of dirs, copy_origin is cleared during the process
    async moveFiles_copyRecurse(conn:PoolConnection, userSer: number): Promise<void> {
        let result: ResultSetHeader;
        do{
            const [newdirs] = await conn.execute<RowDataPacket[]>(`select file_serial from file where user_serial=? and type='dir' and copy_origin<>0 for share`, [userSer]);
            let str1 = `insert into file (user_serial, parent_serial, type, file_name, last_modified, copy_origin) `;
            str1 += `select f1.user_serial, f2.file_serial, f1.type, f1.file_name, f1.last_modified, f1.file_serial `;
            str1 += `from file as f1 inner join file as f2 on f1.parent_serial=f2.copy_origin `; // f1: file to copy, f2: dir already copied
            str1 += `where f2.user_serial=? and f2.copy_origin<>0 and f2.type='dir' and f1.user_serial=? `;
            [result] = await conn.execute<ResultSetHeader>(str1, [userSer, userSer]);
            if (newdirs.length > 0) {
                await conn.query(`update file set copy_origin=0 where user_serial=? and type='dir' and file_serial in (?)`, [userSer, newdirs.map(val=>val.file_serial)]);
            }
        } while (result.affectedRows > 0);
        await conn.execute<ResultSetHeader>(`update file set copy_origin=0 where user_serial=? and type='dir' and copy_origin<>0`, [userSer]);
    }

    // important!
    // mark shouldn't be used by restore mechanism. it is used by sharecopy.
    private async restoreFiles_checkPath(
        conn: PoolConnection, userSer: number, files_: readonly FileIdentReqDto[]
    ): Promise<{arr: FileIdentReqDto[], arrFail: FileIdentReqDto[], namechange: boolean}> {
        if (files_.length <= 0){
            return {arr: [], arrFail: [], namechange: false};
        }
        let files = files_.slice();
        let arrId = files.map((val)=>val.id);
        // fetch names and other info
        let str1 = `select file_serial, parent_path, file_name, type from recycle `;
        str1 += `where user_serial=? and (file_serial, last_renamed) in (?) order by parent_path `;
        str1 += 'for update';
        let [result] = await conn.query<RowDataPacket[]>(
            str1, [userSer, files.map((val)=>[val.id, val.timestamp])]
        );
        // make path (call makepath), and check for name clashes
        str1 = `select file_serial from file `;
        str1 += `where user_serial=? and parent_serial=? and type=? and file_name=? `;
        str1 += 'for update';
        let curPath = '';
        let dirid: number;
        let namechange = false;
        let retArr: FileIdentReqDto[] = [];
        const addedNames: string[] = [];
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
                if (result2.length <= 0 && (addedNames.indexOf(curPath + newname) === -1)){
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
            let loc = arrId.indexOf(result[i].file_serial);
            if (loc === -1){this.logger.error('restorefiles: ' + result[i].file_serial);continue;}
            arrId.splice(loc,1);
            retArr.push(...files.splice(loc,1));
            addedNames.push(curPath + newname);
        }
        return {arr: retArr, arrFail: files, namechange};
    }

    // important!
    // mark shouldn't be used by restore mechanism. it is used by sharecopy.
    private async restoreFiles_mark(conn: PoolConnection, userSer: number, arr_: readonly number[]): Promise<void> {
        if (arr_.length <= 0){
            return;
        }
        let arr =  arr_.slice();
        let str1 = `update recycle set to_restore='true' where user_serial=? and file_serial in (?) `;
        let str2 = `update recycle set to_restore='true' where user_serial=? and parent_serial in (?) and del_type='recursive' `;
        let str3 = `select file_serial from recycle where user_serial=? and parent_serial in (?) and type='dir' and del_type='reucrsive' `;
        str3 += 'for update';
        await conn.query(str1, [userSer, arr]);
        let result: RowDataPacket[];
        while (arr.length > 0) {
            await conn.query(str2, [userSer, arr]);
            [result] = await conn.query<RowDataPacket[]>(str3, [userSer, arr]);
            arr = result.map((val)=>val.file_serial);
        }
    }

    // important!
    // mark shouldn't be used by restore mechanism. it is used by sharecopy.
    private async restoreFiles_moveFile(conn: PoolConnection, userSer: number): Promise<void> {
        const recDir = await this.getUserRoot(userSer, 'recycle');
        await conn.execute(`delete from file where user_serial=? and parent_serial=?`, [userSer, recDir]);
        let str1 = `insert into file (user_serial, parent_serial, type, file_name, file_serial, last_modified) `;
        // set parent_serial and file_name as temporary to prevent foreign key failures
        str1 += `select user_serial, ?, type, file_serial, file_serial, last_modified from recycle `;
        str1 += `where user_serial=? and to_restore='true' `;
        // str1 += 'for update';
        await conn.execute(str1, [recDir, userSer]);
        str1 = `update file inner join recycle using (file_serial) `;
        str1 += `set file.file_name=recycle.file_name, file.parent_serial=recycle.parent_serial where file.user_serial=? and file.parent_serial=?`;
        await conn.execute(str1, [userSer, recDir]);
        str1 = `delete from recycle `;
        str1 += `where user_serial=? and to_restore='true' `;
        await conn.execute(str1, [userSer]);
    }

    async restoreFiles(
        conn: PoolConnection, userSer: number, arr_: readonly FileIdentReqDto[]|number
    ): Promise<{arr: FileIdentReqDto[], arrFail: FileIdentReqDto[], clash_toolong: boolean, namechange: boolean}> {
        // create path. check if file already exists there. then get the appropriate name to add
        // important!
        // mark shouldn't be used by restore mechanism. it is used by sharecopy.
        if (typeof arr_ === 'number'){
            let [res] = await conn.execute<RowDataPacket[]>(
                `select last_renamed from recycle where user_serial=? and file_serial=? for share`,
                [userSer, arr_]
            );
            if (res.length <= 0){return {arr: [{id: arr_, timestamp: new Date()}], arrFail: [], clash_toolong: false, namechange: false};}
            arr_ = [{id: arr_, timestamp: res[0].last_renamed as Date}];
        }
        let { arr, arrFail, namechange } = await this.restoreFiles_checkPath(conn, userSer, arr_);
        let clash_toolong = (arrFail.length > 0);
        await this.restoreFiles_mark(conn, userSer, arr.map((val)=>val.id));
        await this.restoreFiles_moveFile(conn, userSer);

        return {arr, arrFail, clash_toolong, namechange};
    }

    private async shareCopy_createFile(conn: PoolConnection, userSer: number, files_: readonly FileIdentReqDto[], friends_: readonly number[]): Promise<void> {
        if ((files_.length <= 0) || (friends_.length <= 0)){
            return;
        }
        // note: users can share file that are read/edit shared from others.
        // the validity of sender's access is checked beforehand, and shouldn't be checked here
        // clean 'mark' columns
        await conn.query(`update recycle set mark='false' where mark='true' and user_serial in (?)`, [friends_]);
        await conn.execute(`update file set mark='false' where mark='true' and user_serial=?`, [userSer]);
        // insert into file to get file_serials
        let cte = `(select 1 union all select num+1 from cte where num<?) `;
        let str1 = `with recursive cte (num) as `;
        str1 += cte;
        let subt = '(user_serial, parent_serial, type, file_name, mark)';
        str1 = `insert into file ${subt} ${str1} select ?, 1, 'dir', concat(? ,num), 'true' from cte `;
        await conn.execute(str1, [files_.length * friends_.length, userSer, userSer + '-']);
        // retrieve the created file_serials
        let [result] = await conn.execute<RowDataPacket[]>(
            `select file_serial from file where user_serial=? and parent_serial=1 and mark='true'`, [userSer]
        );
        const fileCnt = files_.length;
        const friendCnt = friends_.length;
        if (result.length !== fileCnt * friendCnt){
            throw new InternalServerErrorException();
        }
        const arrSerial: [number, number, number][] = result.map(val=>[val.file_serial, -1, -1]);
        for (let i = 0; i < arrSerial.length; i++){
            arrSerial[i][1] = files_[i % fileCnt].id;
            arrSerial[i][2] = friends_[Math.floor(i/fileCnt)];
        }
        // place in temp_share
        await conn.query(`create temporary table temp_share (file_serial bigint unsigned, copy_origin bigint unsigned, user_serial int unsigned)`);
        await conn.query(`insert into temp_share (file_serial, copy_origin, user_serial) values ?`, [arrSerial]);
        // insert into recycle
        const recy_cols = 'user_serial, parent_serial, parent_path, type, file_name, file_serial, last_modified, del_type, mark, copy_origin';
        str1 = `insert into recycle (${recy_cols}) `;
        str1 += `select temp_share.user_serial, 1, 'files/inbox', file.type, file.file_name, temp_share.file_serial, file.last_modified, 'recursive', 'true', temp_share.copy_origin `;
        str1 += `from temp_share inner join file on temp_share.copy_origin=file.file_serial `;
        await conn.execute(str1);
        // set parent_serial
        str1 = `update recycle inner join (select file_serial, user_serial from file where file_name='inbox' and issys='true') as inbox using (user_serial) `;
        str1 += `set recycle.parent_serial=inbox.file_serial where recycle.mark='true'`; // leave mark to true, for use when restoring
        await conn.execute(str1);
        // drop temptable
        await conn.execute(`drop temporary table temp_share`);
        // delete the created files in 'file' table
        await conn.execute(`delete from file where user_serial=? and parent_serial=1 and mark='true'`, [userSer]);
        // note that mark in recycle is left as true for future use here.
    }

    private async shareCopy_restore(conn: PoolConnection, userSer: number, files_: readonly FileIdentReqDto[], friends_: readonly number[]): Promise<[number, string, number][]> {
        if ((friends_.length <= 0) || (files_.length <= 0)){
            return [];
        }
        // check for name collisions first! first move all to recycle, and reuse the recovery algorithm
        let [result] = await conn.query<RowDataPacket[]>(
            // intentionally not 'for share', for efficiency
            `select user_serial from user where user_serial in (?) and auto_receive_files='true' `, [friends_]
        );
        if (result.length <= 0){
            return [];
        }
        
        let arrRet: [number, string, number][] = [];
        let str1 = `select file_serial, last_renamed from recycle `;
        str1 += `where user_serial=? and mark='true' for update`; // mark shouldn't be used by restore mechanism
        for (let i = 0; i < result.length; i++){
            let [resFile] = await conn.execute<RowDataPacket[]>(
                str1, [result[i].user_serial]
            );
            let res = await this.restoreFiles(conn, result[i].user_serial, resFile.map(val=>{return {id: val.file_serial, timestamp: val.last_renamed};}));
            [resFile] = await conn.query<RowDataPacket[]>(`select file_serial, file_name, user_serial from file where file_serial in (?)`, [res.arr.map(val=>val.id)]);
            arrRet = arrRet.concat(resFile.map(val=>[val.file_serial, val.file_name, val.user_serial]));
        }

        return arrRet;
    }

    private async shareCopy_notify(
        conn: PoolConnection, userSer: number, savedfiles_: readonly [number, string, number][], friends_: readonly number[], message: string
    ): Promise<void> {
        const arrNof: NotifColDto[] = [];
        let [result] = await conn.query<RowDataPacket[]>(
            `select file_name, file_serial, user_serial from recycle where user_serial in (?) and mark='true'`, [friends_]
        );
        for (const itm of result){
            const data: ShareCopyNotifDto = {
                sender_ser: userSer, file_name: itm.file_name, file_ser: itm.file_serial,
                saved: false, message: message};
            arrNof.push({data: data, read: false, to: itm.user_serial, type: 'file_shared_inbox', urlArr: []});
        }
        for (const itm of savedfiles_){
            const data: ShareCopyNotifDto = {
                sender_ser: userSer, file_name: itm[1], file_ser: itm[0],
                saved: true, message: message};
            arrNof.push({data: data, read: false, to: itm[2], type: 'file_shared_inbox', urlArr: []});
        }
        await this.mongoService.getDb().collection('notification').insertMany(arrNof);
    }

    async shareCopy(
        conn: PoolConnection, userSer: number, files_: readonly FileIdentReqDto[], friends_: readonly number[], message: string
    ): Promise<FileShareResDto>{
        if (friends_.length <= 0){
            return {addarr: [], failed: [], delarr: []};
        }
        // for sharecopy, only files that user owns can be shared, as shared_def depends on friend_mono
        let retVal = new FileShareResDto();
        retVal.addarr = []; // always empty as the result shouldn't really be visible to sender in copy mode
        retVal.failed = []; // always empty. if some fail, then server failure will be sent instead
        if (files_.length * friends_.length > 200){
            retVal.failed = files_.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
            retVal.failreason = '복사 방식으로는 (전송 파일 개수)x(전송 인원)이 200을 초과할 수 없습니다.';
            return retVal;
        }
        // move to recycle
        // items are left mark='true' in recycle, for future use.
        await conn.execute(`update recycle set copy_origin=0 where copy_origin<>0`);
        await this.shareCopy_createFile(conn, userSer, files_, friends_);
        // then restore if the receiver turned restore on.
        let [result] = await conn.query<RowDataPacket[]>(
            `select file_serial, copy_origin from recycle where user_serial in (?) and mark='true' for share`, [friends_]
        );
        await this.copyMongo(result.map(val=>{return {id: val.file_serial, origin: val.copy_origin};}));
        const savedfiles = await this.shareCopy_restore(conn, userSer, files_, friends_);
        await this.shareCopy_notify(conn, userSer, savedfiles, friends_, message);
        return retVal;
    }

    async shareReadEdit(
        conn: PoolConnection, userSer: number, files_: readonly number[], friends_: readonly number[], edit: boolean, message: string
    ): Promise<FileShareResDto>{
        if ((friends_.length <= 0) || (files_.length <= 0)){
            return {addarr: [], failed: [], delarr: []};
        }
        let retVal = new FileShareResDto();
        let [result] = await conn.query<RowDataPacket[]>(
            `select file_serial from shared_def where user_serial_from=? and file_serial in (?)`, [userSer, files_]
        );
        let dupFiles = result.map(val=>val.file_serial);
        let shareType: 'edit'|'read' = edit ? 'edit' : 'read';
        // check for already shared files first
        await conn.execute(`update shared_def set mark='false' where user_serial_from=? and mark='true'`, [userSer]);
        let subt = '(user_serial_to, user_serial_from, file_serial, file_name, share_type, mark)';
        let str1 = `insert into shared_def ${subt} select fm.user_serial_to, fm.user_serial_from, file.file_serial, file.file_name, ?, 'true' `;
        str1 += `from friend_mono as fm cross join file `;
        str1 += `where fm.user_serial_from=? and fm.user_serial_to in (?) and file.user_serial=? and file.file_serial in (?) `;
        str1 += `on duplicate key update share_type=if(share_type='read',?,'edit'), mark=${shareType==='read'?"'false'":"if(share_type='read','true','false')"}` // marked true only for new inserts
        await conn.query(
            str1, [shareType, userSer, friends_, userSer, files_, shareType]
        );
        str1 = `select type, file.file_name, date_shared, file.bookmarked as bookmarked, last_modified, file_serial, last_renamed, user_serial_to `;
        str1 += `from shared_def inner join file using (file_serial) `;
        str1 += `where user_serial_from=? and shared_def.mark='true' for update `;
        [result] = await conn.execute<RowDataPacket[]>(str1, [userSer]);
        retVal.addarr = result.map(val=>{
            return {
                link: val.type==='dir' ? `/files?dirid=${val.file_serial}` : `/edit?id=${val.file_serial}`,
                id: val.file_serial,
                isFolder: val.type==='dir',
                text: val.file_name,
                bookmarked: val.bookmarked==='true',
                shared: '', // temporary. added with this.resolveSharedNames
                date: val.last_modified,
                dateShared: val.date_shared,
                ownerName: String(userSer),
                ownerImg: '/graphics/profimg',
                timestamp: val.last_renamed
            }
        });
        for (const itm of retVal.addarr){
            if (dupFiles.includes(itm.id)){
                retVal.delarr.push({id: itm.id, timestamp: itm.timestamp});
            }
        }
        let arrNof: NotifColDto[] = [];
        for (const itm of result){
            const obj: ShareHardNotifDto = {
                file_name: itm.file_name, fileid: itm.file_serial, mode: shareType, sender_ser: userSer, message: message
            };
            arrNof.push({data: obj, read: false, to: itm.user_serial_to, type: 'file_shared_hard',
                urlArr: [['폴더 열기', '/files/shared'], ['파일 열기', '/edit?id=' + itm.file_serial]]});
        }
        await conn.execute(`update shared_def set mark='false' where user_serial_from=? and mark='true'`, [userSer]);
        await this.resolveSharedNames(retVal.addarr, conn, true);
        await this.replaceNames(userSer, retVal.addarr);
        if (arrNof.length > 0){
            await this.mongoService.getDb().collection('notification').insertMany(arrNof);
        }
        return retVal;
    }
    
    // called from the receiver (with only the file numbers)
    // or the sender (with a single file number and multiple friends)
    async removeShare(conn: PoolConnection, userSer: number, files_: readonly FileIdentReqDto[], message: string, friend?: number): Promise<FileDelResDto>{
        if (files_.length <= 0){
            return {delarr: [], failed: []};
        }
        let retVal = new FileDelResDto();
        let filearr = files_.map(val=>val.id);
        let friendarr = friend ? [friend] : [];
        if (friend === undefined){ // from the receiver, called from shared page
            const [resFriend] = await conn.query<RowDataPacket[]>(
                `select user_serial_from from shared_def where user_serial_to=? and file_serial in (?) for update`,
                [userSer, filearr]
            );
            if (resFriend.length > 0){
                friendarr = resFriend.map(val=>val.user_serial_from);
            }
            await conn.query(
                `delete from shared_def where user_serial_to=? and file_serial in (?) `,
                [userSer, filearr]
            );
        } else { // from profiels page, either from sender or receiver
            if (files_.length !== 1){throw new BadRequestException();}
            await conn.query(
                `delete from shared_def where ((user_serial_from=? and user_serial_to=?) or (user_serial_from=? and user_serial_to=?)) and file_serial=?`,
                [userSer, friend, friend, userSer, files_[0].id]
            );
        }
        retVal.delarr = files_.map(val=>{return {id: val.id, timestamp: val.timestamp};});
        if (typeof message === 'string' && message.trim().length > 0 && friendarr.length > 0){
            const [fileNames] = await conn.query<RowDataPacket[]>(
                `select file_serial, file_name from file where user_serial=? and file_serial in (?)`, // nonlocking
                [userSer, filearr]
            );
            const mapFileNames = new Map(fileNames.map(val=>[val.file_serial, val.file_name]));
            const docs: NotifColDto[] = [];
            for (const itm of friendarr){
                for (const fileInfo of files_){
                    const dat: UnshareNotifDto = {
                        file_name: mapFileNames.get(fileInfo.id) ?? '(알 수 없음)', file_ser: fileInfo.id, message: message, sender_ser: userSer
                    };
                    const doc: NotifColDto = {data: dat, read: false, to: itm, type: 'file_unshared', urlArr: []};
                    docs.push(doc);
                }
            }
            await this.mongoService.getDb().collection('notification').insertMany(docs);
        }
        return retVal;
    }

    async addShare(
        conn: PoolConnection, userSer: number, files_: readonly FileIdentReqDto[], friends_: readonly number[],
        mode: "copy" | "read" | "edit", message: string
    ): Promise<FileShareResDto>{
        if (files_.length <= 0){
            return {addarr: [], failed: [], delarr: []};
        }
        let retVal = new FileShareResDto();
        retVal.addarr = [];
        retVal.failed = [];
        let filearr = files_.map(val=>val.id);
        if (mode === 'copy'){
            retVal = await this.shareCopy(conn, userSer, files_, friends_, message);
        } else {
            let [result] = await conn.query<RowDataPacket[]>(
                `select file_serial from file where user_serial=? and file_serial in (?)`, [userSer, filearr]
            );
            if (result.length < files_.length){
                retVal.failed = files_.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
                retVal.failreason = '사본 공유 이외의 공유는 소유한 파일에 대해서만 가능합니다.';
                return retVal;
            }
            retVal = await this.shareReadEdit(conn, userSer, filearr, friends_, mode === 'edit', message);
        }
        return retVal;
    }

    async removeBookmark(conn: PoolConnection, userSer: number, files_: readonly FileIdentReqDto[]): Promise<FileDelResDto>{
        if (files_.length <= 0){
            return {delarr: [], failed: []};
        }
        let retVal = new FileDelResDto();
        retVal.delarr = [];
        retVal.failed = [];
        // consider both own files and external files
        let filelist = files_.map<[number, Date]>(val=>[val.id, val.timestamp]);
        let [result] = await conn.query<ResultSetHeader>(
            `update file set bookmarked='false' where user_serial=? and (file_serial, last_renamed) in (?) `, [userSer, filelist]
        );
        let subq = `select file_serial from file where (file_serial, last_renamed) in (?) for share`;
        let [result2] = await conn.query<ResultSetHeader>(
            `update shared_def set bookmarked='false' where user_serial_to=? and file_serial in (${subq}) `, [userSer, filelist]
        );
        if (result.affectedRows + result2.affectedRows >= files_.length){
            retVal.delarr = files_.map(val=>{return {id: val.id, timestamp: val.timestamp.toISOString()};});
            return retVal;
        } else {
            let [result] = await conn.query<RowDataPacket[]>(
                `select file_serial, last_renamed from file where user_serial=? and bookmarked='false' and (file_serial, last_renamed) in (?) for share`,
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
            retVal.failed = Array.from(mapFiles, val=>{return{id: val[0], timestamp: val[1]};});
        }
        return retVal;
    }

    async addBookmark(conn: PoolConnection, userSer: number, files_: readonly FileIdentReqDto[]): Promise<FileDelResDto>{
        if (files_.length <= 0){
            return {delarr: [], failed: []};
        }
        let retVal = new FileDelResDto();
        retVal.delarr = [];
        retVal.failed = [];
        // consider both own files and external files
        let filelist = files_.map<[number, Date]>(val=>[val.id, val.timestamp]);
        let [result] = await conn.query<ResultSetHeader>(
            `update file set bookmarked='true' where user_serial=? and (file_serial, last_renamed) in (?) `, [userSer, filelist]
        );
        let subq = `select file_serial from file where (file_serial, last_renamed) in (?) for share`;
        let [result2] = await conn.query<ResultSetHeader>(
            `update shared_def set bookmarked='true' where user_serial_to=? and file_serial in (${subq}) `, [userSer, filelist]
        );
        if (result.affectedRows + result2.affectedRows >= files_.length){
            return retVal;
        } else {
            let [result] = await conn.query<RowDataPacket[]>(
                `select file_serial from file where user_serial=? and bookmarked='true' and (file_serial, last_renamed) in (?) for share`,
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

    async createFile(conn: PoolConnection, userSer: number, parent: number, name: string, sort: SortModeDto){
        if (name.length <= 0) {throw new BadRequestException();}
        if (name.length > 40) {throw new BadRequestException();}
        let retVal = new FileMoveResDto();
        retVal.addarr = [];
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
        retVal.addarr = [{
            link: `/edit?id=${result.insertId}`,
            id: result.insertId,
            isFolder: false,
            text: name,
            bookmarked: false,
            shared: '',
            date: result2[0].last_modified.toISOString(),
            ownerImg: '/graphics/profimg',
            timestamp: result2[0].last_renamed.toISOString()
        }]
        await this.resolveBefore(conn, userSer, sort, retVal.addarr, 'files', parent);
        const arrDocs: FiledatColDto[] = [];
        for (const itm of retVal.addarr){
            const dirpath = join(__dirname, `../../filesys/${itm.id}`);
            await fs.mkdir(dirpath, {});
            await (await fs.open(join(dirpath, '1'), 'wx')).close();
            arrDocs.push({arrlen: 1, metadata: {}, serial: itm.id, type: 'rmb0.3', user_serial: userSer});
        }
        await this.mongoService.getDb().collection('file_data').insertMany(arrDocs);
        return retVal;
    }

    async createDir(conn: PoolConnection, userSer: number, parent: number, name: string, sort: SortModeDto){
        if (name.length <= 0) {throw new BadRequestException();}
        if (name.length > 40) {throw new BadRequestException();}
        let retVal = new FileMoveResDto();
        retVal.addarr = [];
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
        retVal.addarr = [{
            link: `/files?dirid=${result.insertId}`,
            id: result.insertId,
            isFolder: true,
            text: name,
            bookmarked: false,
            shared: '',
            date: result2[0].last_modified.toISOString(),
            ownerImg: '/graphics/profimg',
            timestamp: result2[0].last_renamed.toISOString()
        }];
        await this.resolveBefore(conn, userSer, sort, retVal.addarr, 'files', parent);
        return retVal;
    }

    async renameFile(conn: PoolConnection, userSer: number, parent: number, file: {id: number, timestamp: Date}, name: string){
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
            [userSer, parent, file.id, file.timestamp]
        );
        // if expired
        if (result.length <= 0){
            retVal.expired = true;
            retVal.failed = [[file.id, file.timestamp.toISOString()]];
            return retVal;
        }
        // if already exists
        [result] = await conn.execute<RowDataPacket[]>(
            `select type from file where user_serial=? and parent_serial=? and type=? and file_name=? for update `,
            [userSer, parent, result[0].type, name]
        );
        if (result.length > 0){
            retVal.alreadyExists = true;
            retVal.failed = [[file.id, file.timestamp.toISOString()]];
            return retVal;
        }
        await conn.execute(
            `update file set file_name=?, last_renamed=current_timestamp where user_serial=? and file_serial=?`, [name, userSer, file.id]
        );
        await conn.execute(
            `update shared_def set file_name=? where user_serial_from=? and file_serial=?`, [name, userSer, file.id]
        );
        [result] = await conn.execute<RowDataPacket[]>(
            `select * from file where user_serial=? and file_serial=? for share`, [userSer, file.id]
        );
        let [result2] = await conn.execute<RowDataPacket[]>(
            `select user_serial_to from shared_def where user_serial_from=? and file_serial=?`,
            [userSer, file.id]
        );
        retVal.delarr = [{id: file.id, timestamp: file.timestamp}];
        retVal.addarr.push({
            link: `/files?dirid=${result[0].file_serial}`,
            id: result[0].file_serial,
            isFolder: result[0].type === 'dir',
            text: result[0].file_name,
            bookmarked: result[0].bookmarked === 'true',
            shared: result2.map(val=>val.user_serial_to).join(','),
            date: result[0].last_modified,
            ownerImg: '/graphics/profimg',
            timestamp: result[0].last_renamed,
        });
        await this.replaceNames(userSer, retVal.addarr);
        return retVal;
    }

    async signupCreateDir(conn: PoolConnection, user_serial: number){
        await conn.execute<RowDataPacket[]>(
            `insert into file (user_serial, parent_serial, type, issys, file_name)
            values (?, 1, 'dir', 'true', 'files'), (?, 1, 'dir', 'true', 'upload_tmp')`, [user_serial, user_serial]
        );
        // await conn.execute<RowDataPacket[]>(
        //     'update file set parent_serial=file_serial where user_serial=?', [user_serial]
        // );
        let [result] = await conn.execute<RowDataPacket[]>(
            `select file_serial from file where user_serial=? and file_name='files' for share`, [user_serial]
        );
        await conn.execute<RowDataPacket[]>(
            `insert into file (user_serial, parent_serial, type, issys, file_name)
            values (?, ?, 'dir', 'true', 'bookmarks'), (?, ?, 'dir', 'true', 'inbox'),
            (?, ?, 'dir', 'true', 'shared'), (?, ?, 'dir', 'true', 'recycle')`,
            Array(4).fill([user_serial, result[0].file_serial]).flat()
        );
    }

    private async clearSessions(conn: PoolConnection, userSer: number){
        await conn.execute(
            `delete from session where user_serial=?`, [userSer]);
    }

    async deleteFriends(conn: PoolConnection, userSer: number, arr_: readonly number[]){
        if (arr_.length <= 0){
            return;
        }
        await conn.query(
            `delete from shared_def where (user_serial_to=? and user_serial_from in (?)) or (user_serial_from=? and user_serial_to in (?))`,
            [userSer, arr_, userSer, arr_]
        );
        await conn.query(
            `delete from friend where (user_serial_to=? and user_serial_from in (?)) or (user_serial_from=? and user_serial_to in (?))`,
            [userSer, arr_, userSer, arr_]
        );
        await conn.query(
            `delete from friend_mono where (user_serial_to=? and user_serial_from in (?)) or (user_serial_from=? and user_serial_to in (?))`,
            [userSer, arr_, userSer, arr_]
        );
    }

    private async clearFriends(conn: PoolConnection, userSer: number){
        let [result] = await conn.execute<RowDataPacket[]>(
            `select user_serial_to from friend_mono where user_serial_from=? for update`, [userSer]
        );
        await this.deleteFriends(conn, userSer, result.map(val=>val.user_serial_to));
    }

    async delUser(userSer: number){
        await this.mysqlService.doTransaction('delUser', async conn=>{
            // re-remove all friends
            await this.clearFriends(conn, userSer);
            // re-remove all sessions
            await this.clearSessions(conn, userSer);
            // remove notifications
            await this.mongoService.getDb().collection('notification').deleteMany({to: userSer});
            // remove physical files
            const fileCol = this.mongoService.getDb().collection('file_data');
            const fileList = await fileCol.find({user_serial: userSer});
            try{
                for await (const itm of fileList){
                    try{
                        await fs.rm(join(__dirname, `../../filesys/${itm.serial}`), {force: true, recursive: true});
                    } catch (err) {
                        console.log(err);
                    }
                }
            } catch (err) {
                throw err;
            } finally {
                await fileList.close();
            }
            // remove file data
            await fileCol.deleteMany({user_serial: userSer});
            // remove all files
            const root = await this.getUserRoot(userSer, 'files');
            await conn.execute(
                `update file set parent_serial=if(parent_serial=1,1,?), file_name=file_serial where user_serial=?`,
                [root, userSer]
            );
            await conn.execute(`delete from file where user_serial=? and parent_serial<>1`, [userSer]);
            await conn.execute(`delete from file where user_serial=?`, [userSer]);
            // remove all recycles
            await conn.execute(`delete from recycle where user_serial=?`, [userSer]);
            // add to old_id
            await conn.execute(`insert into old_id (user_id, user_serial) select user_id, user_serial from user where user_serial=?`, [userSer]);
            // remove google
            await conn.execute(`delete from user_google where user_serial=?`, [userSer]);
            // remove user
            let [result] = await conn.execute<ResultSetHeader>(`delete from user where user_serial=?`, [userSer]);
            if (result.affectedRows <= 0){
                throw new InternalServerErrorException();
            }
        });
    }

    async preDelUser(conn: PoolConnection, userSer: number){
        // remove all friends - a separate transaction
        await this.clearFriends(conn, userSer);
        // remove all sessions
        await this.clearSessions(conn, userSer);
        let [result] = await conn.execute<ResultSetHeader>(`update user set user_deleted='true' where user_serial=?`, [userSer]);
        if (result.affectedRows <= 0){
            throw new InternalServerErrorException();
        }
    }
}
