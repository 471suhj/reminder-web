import { MongoService } from "src/mongo/mongo.service";
import { MysqlService } from "src/mysql/mysql.service";
import { FilesService } from "./files.service";
import { BadRequestException, forwardRef, Inject, InternalServerErrorException, Logger } from "@nestjs/common";
import { FileUtilsService } from "./file-utils.service";
import { FileGetResDto } from "./file-get-res.dto";
import { SysdirType } from "./sysdir.type";
import { PrefsService } from "src/prefs/prefs.service";
import { SortModeDto } from "./sort-mode.dto";
import { FileMoreDto } from "./file-more.dto";
import { Efile } from "src/mysql/file.entity";
import { DataSource, FindOptionsOrder, FindOptionsWhere, In, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual } from "typeorm";
import { Ebookmark } from "src/mysql/bookmark.entity";
import { Eshared_def } from "src/mysql/shared_def.entity";
import { Erecycle } from "src/mysql/recycle.entity";
import { FriendMoreDto } from "./friend-more.dto";
import { Efriend_mul } from "src/mysql/friend_mul.entity";
import { RowDataPacket } from "mysql2";
import { FileIdentReqDto } from "./file-ident-req.dto";
import { FileIdentResDto } from "./file-ident-res.dto";
import { Connection } from "mysql2/promise";
import { UserInsertResDto } from "./user-insert-res.dto";
import { FileInsertResDto } from "./file-insert-res.dto";

export class FileResolutionService {

    constructor(
        private readonly mysqlService: MysqlService,
        private readonly prefsService: PrefsService,
        private readonly dataSource: DataSource,
        @Inject(forwardRef(()=>FilesService)) private readonly filesService: FilesService,
        @Inject(forwardRef(()=>FileUtilsService)) private readonly fileUtilsService,
    ) {}

    private readonly logger = new Logger(FileResolutionService.name);

    async renderFilesPage(userSer: number, dirid: number): Promise<FileGetResDto>{
        let retObj: FileGetResDto = new FileGetResDto();
        // includes user verification
        const {path, pathHtml, parentId, dirName, lastRenamed, issys} = await this.fileUtilsService.getDirInfo(await this.mysqlService.getSQL(), userSer, dirid);
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

    async renderSharedPage(userSer: number, dirType: SysdirType['val']): Promise<FileGetResDto>{
        if (!SysdirType.arr.includes(dirType)){
            throw new BadRequestException('요청된 폴더 종류는 내장 폴더가 아닙니다.');
        }
        let retObj: FileGetResDto = new FileGetResDto();
        const dirid = await this.fileUtilsService.getUserRoot(userSer, dirType);

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
        let crit = ['type', ...this.fileUtilsService.translateColumnBase(sort.criteria, 'files')];
        let retVal = new FileMoreDto();
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
        let crit = ['type', ...this.fileUtilsService.translateColumnBase(sort.criteria, 'bookmarks')];
        let retVal = new FileMoreDto();
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
        let crit = [...this.fileUtilsService.translateColumnBase(sort.criteria, 'shared')];
        let retVal = new FileMoreDto();
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
                            user_serial_to: In([userSer, friend]),
                        },
                        user_serial: In([friend, userSer]),
                    }
                });
                if (result.length <= 0){
                    retVal.needRefresh = true;
                    throw new Error('rollback_');
                }
                const lenTmp = crit.length;
                const ulim = friend ? lenTmp * 2 : lenTmp;
                const myFile = result[0].user_serial === userSer;
                for (let k = 0; k < ulim; k++){
                    let i = k % lenTmp;
                    wherearr.push({...((i === k) ? whereObj1 : whereObj2)});
                    let j = 0;
                    wherearr[k].file = {};
                    for (; j < lenTmp - 1 - i; j++){
                        if (crit[j] === 'date_shared') {
                            wherearr[k][crit[j]] = result[0].shares[0][crit[j]];
                        } else {
                            wherearr[k].file![crit[j]] = result[0][crit[j]];
                        }
                    }
                    if (crit[j] === 'date_shared') {
                        if (!myFile && k === lenTmp) { // not greater than: most detailed criteria only
                            wherearr[k][crit[j]] = sort.incr ? MoreThanOrEqual(result[0].shares[0][crit[j]]) : LessThanOrEqual(result[0].shares[0][crit[j]]);
                        } else {
                            wherearr[k][crit[j]] = sort.incr ? MoreThan(result[0].shares[0][crit[j]]) : LessThan(result[0].shares[0][crit[j]]);
                        }
                    } else {
                        if (!myFile && k === lenTmp) {
                            wherearr[k].file![crit[j]] = sort.incr ? MoreThanOrEqual(result[0][crit[j]]) : LessThanOrEqual(result[0][crit[j]]);
                        } else {
                            wherearr[k].file![crit[j]] = sort.incr ? MoreThan(result[0][crit[j]]) : LessThan(result[0][crit[j]]);
                        }
                    }
                }
            } else {
                wherearr = friend ? [whereObj1, whereObj2] : [whereObj1];
            }
            const orderObj = {};
            for (const itm of crit){ // impossible to order by date_shared in the middle. major pitfall
                if (itm === 'date_shared') {
                    orderObj[itm] = sort.incr ? "ASC" : "DESC";
                } else {
                    if (orderObj['file'] === undefined) {
                        orderObj['file'] = {};
                    }
                    orderObj['file'][itm] = sort.incr ? "ASC" : "DESC";
                }
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
        let crit = ['type', ...this.fileUtilsService.translateColumnBase(sort.criteria, 'recycle')];
        let retVal = new FileMoreDto();
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

    private async loadFriendMore_fillInfo(lst: UserInsertResDto[]){
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
        let ret = new FileMoreDto();
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
                    throw new InternalServerErrorException('dirDate is not defined when context is files');
                }
                ret = await this.loadFileMore(userSer, dirOrFriend, dirDate, lastitm.id, lastitm.timestamp, sort);
            } else if (context === 'recycle'){
                ret = await this.loadRecycleMore(userSer, lastitm.id, lastitm.timestamp, sort);
            } else if (context === 'shared'){
                ret = await this.loadSharedMore(userSer, lastitm.id, lastitm.timestamp, sort, dirOrFriend);
            } else {throw new BadRequestException('resolveLoadmore: none of the above');}
    
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
        if (sort.criteria === 'colDateShared') { // file_shared does not exist, and should be handled separately
            files.forEach((itm)=>{itm.before = {id: -1, timestamp: new Date()};});
            return files;
        }

        orderby += `${this.fileUtilsService.translateColumnBase(sort.criteria, 'files').join(' ' + (sort.incr ? 'asc' : 'desc') + ', ')} ${sort.incr ? 'asc' : 'desc'}`;
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

    async replaceNames(userSer: number, lst: FileInsertResDto[]){
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

    async resolveSharedNames(lst: FileInsertResDto[], conn?: Connection, lock?: boolean): Promise<void> {
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

}