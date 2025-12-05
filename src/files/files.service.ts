import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { RowDataPacket, Pool, PoolConnection } from 'mysql2/promise';
import { FilesGetDto } from './files-get.dto';
import { PrefsService } from 'src/prefs/prefs.service';
import { SysdirType } from './sysdir.type';
import { FileDelResDto } from './file-del-res.dto';
import { FileIdentResDto } from './file-ident-res.dto';
import { FileIdentReqDto } from './file-ident-req.dto';

@Injectable()
export class FilesService {
    constructor(private mysqlService: MysqlService, private prefsService: PrefsService){}

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
        await this.mysqlService.doTransaction('files service getPath', async function(conn){
            while (cont){
                let firstReq = true;
                [result] = await conn.execute<RowDataPacket[]>( // for repeatable read
                    'select parent_serial, file_name from file where user_serial=? and file_serial=? for share', [userSer, fileId]);
                if (result.length <= 0) {
                    if (firstReq){
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
        retObj = {...retObj, ...(await this.prefsService.getUserCommon(userSer, sideName))};
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
            str1 += `and type<>'dir' `;
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

    translateColumn(val: string, mode: SysdirType['val']){
        if (!SysdirType.arr.includes(val)){
            throw new BadRequestException();
        }
        let dbName: string;
        switch(mode){
            case 'files': case 'inbox': dbName = 'file'; break;
            case 'bookmarks': dbName = 'bmt'; break; // should not be depended upon
            case 'shared': dbName = 'shared_def'; break;
            case 'recycle': dbName = 'recycle'; break;
            default: throw new BadRequestException();
        }
        const arrColumn = this.translateColumnBase(val, mode);
        for (let i = 0; i < arrColumn.length; i++){
            arrColumn[i] = dbName + '.' + arrColumn[i];
        }
        return {arrColumn, dbName};
    }
    
    generateLoadMore(col: string, incr: boolean, middle: boolean, 
        mode: SysdirType['val']): Array<string>{
        if (!SysdirType.arr.includes(mode)){
            throw new BadRequestException();
        }
        const asc = incr ? 'asc' : 'desc';
        const compOp = incr ? '>' : '<';
        const compOp2 = incr ? '<' : '>';
        const {arrColumn: sortCta, dbName} = this.translateColumn(col, mode);
        // select 1: get the list of files and info excluding shared people
        // select 2: get the list of shared people on the list of files from select 1
        let strSelect1: string;
        let strSelect2: string;
        let strWhere1: string;
        let strWhere2: string;

        if (mode === 'files' || mode === 'inbox'){
            strSelect1 = `select * from ${dbName} `
            strWhere1 = `where user_serial=? and parent_serial=? `;
            strSelect2 = `select file_serial, name from file inner join shared_def using (file_serial)
            inner join user on user_serial_to=user.user_serial `;
            strWhere2 = `where user_serial=? and parent_serial=? `;
            if (middle){
                strWhere1 += `and type ${compOp}= ? `;
                strWhere2 += `and type ${compOp}= ? and type ${compOp2}= ? `;
            }
        } else if (mode === 'bookmarks'){
            let tbl1 = `select user_serial, type, issys, file_name, file_serial, last_renamed, last_modified
                from files where user_serial=? and bookmarked='true'
                for share `;
            let tbl2 = `select user_serial_from, type, issys, file.file_name, file_serial, last_renamed, last_modified
                from files inner join shared_def using (file_serial) where user_serial_to=? and shared_def.bookmarked='true'
                for share `;
            // the derived table to use as base
            let tblUnion = `(${tbl1} union ${tbl2}) as bmt `; // contains only user-related data
            strSelect1 = `select * from ${tblUnion} `;
            strWhere1 = '';
            strSelect2 = `select file_serial, name from ${tblUnion} inner join shared_def using (file_serial)
            inner join user on user_serial_to=user.user_serial `;
            strWhere2 = '';
            if (middle){
                strWhere1 += `where type ${compOp}= ? `;
                strWhere2 += `where type ${compOp}= ? and type ${compOp2}= ? `;
            }
        } else if (mode === 'shared'){
            strSelect1 = `select user_serial, shared_def.bookmarked, file.file_name, type, issys, file_serial, last_renamed, last_modified
                from shared_def inner join file using (file_serial)`;
            strWhere1 = `where user_serial_to=? `;
            strSelect2 = `select file_serial, name from shared_def as t1 inner join shared_def as t2 using (file_serial)
            inner join user on t2.user_serial_to=user.user_serial `;
            strWhere2 = `where t1.user_serial_to=? `;
            if (middle){
                strWhere1 += `and type ${compOp}= ? `;
                strWhere2 += `and type ${compOp}= ? and type ${compOp2}= ? `;
            }
        } else if (mode === 'recycle'){
            strSelect1 = `select * from recycle `
            strWhere1 = `where user_serial=? `;
            strSelect2 ='';
            strWhere2 = '';
            if (middle){
                strWhere1 += `and type ${compOp}= ? `;
            }
        } else {throw new BadRequestException();}
        let strOrder = `order by type ${asc}, `;
        if (middle){
            for (const cta of sortCta){
                strWhere1 += `and ${cta} ${compOp} ? `;
                strWhere2 += `and ${cta} ${compOp} ? and ${cta} ${compOp2}= ? `;
                strOrder += `${cta} ${asc}, `;
            }
        }
        strOrder = strOrder.slice(0, -2) + ' ';
        let strSql1 = strSelect1 + strWhere1 + strOrder + `limit 21 for share`;
        let strSql2 = strSelect2 + strWhere2 + strOrder + `for share`; // need to consider 'for update' on certain conditions
        if (mode !== 'recycle'){
            return [strSql1, strSql2];
        } else {
            return [strSql1];
        }
    }

    generateDelete(mode: SysdirType['val']){
        if (!SysdirType.arr.includes(mode)){throw new BadRequestException();}
        let strDel: Array<string> = [];
        let strWhere: Array<string> = [];
        // beware of unauthorized deletes!
        if (mode === 'files' || mode === 'inbox'){
            throw new BadRequestException();
        } else if (mode === 'bookmarks'){
            strDel.push(`update shared_def set bookmarked='false' `);
            strWhere.push(`where user_serial_to=? and file_serial=? `);
            strDel.push(`update file set bookmarked='false' `);
            strWhere.push(`where user_serial=? and file_serial=? `);
        } else if (mode === 'shared'){
            strDel.push(`delete from shared_def `);
            strWhere.push(`where user_serial_to=? and file_serial in ? `);
        } else if (mode === 'recycle'){
            strDel.push(`delete from recycle `);
            strWhere.push(`where user_serial=? and file_serial in ? `);
        } else {throw new BadRequestException();}
        for (let i = 0; i < strWhere.length; i++){
            if (strDel[i].slice(0, 6) === 'select'){strDel[i] += (strWhere[i] + 'for update');}
        }
        return strDel;
    }

    private async deleteFiles_validity(conn: PoolConnection, userSer: number, arr_: Array<FileIdentReqDto>){
        let arr = arr_.slice(0);
        let str1 = `select file_serial as id, last_renamed as timestamp from file `;
        str1 += `where user_serial=? and (file_serial,last_renamed) in ?) `;
        str1 += 'for update';
        let arr2 = arr.map((val)=>(val.timestamp.toISOString() + val.id));
        let retArr: Array<FileIdentReqDto> = [];
        let [result] = await conn.execute<RowDataPacket[]>(
            str1, [userSer, arr.map((val)=>[val.id, val.timestamp])]
        );
        for (let i = 0; i < result.length; i++){
            let idxTmp = arr2.indexOf(result[i].timestamp.toISOString() + result[i].id);
            if (idxTmp === -1){continue;}
            arr2.splice(idxTmp, 1);
            retArr.push(...arr.splice(idxTmp, 1));
        }
        return {arr: retArr, arrFail: arr.map((val)=>{return {id: val.id, timestamp: val.timestamp.toISOString()};})};
    }

    private async deleteFiles_mark(conn: PoolConnection, userSer: number, arr_: Array<FileIdentReqDto>){
        let arr = arr_.slice(0);
        let str1 = `update file set to_delete='direct' `;
        str1 += `where user_serial=? and file_serial in ? `;
        // str1 += 'for update';
        await conn.execute<RowDataPacket[]>(
            str1, [userSer, arr.map((val)=>val.id)]
        );
        str1 = `select file_serial from file `;
        str1 += `where user_serial=? and to_delete='direct' for update `;
        let [result] = await conn.execute<RowDataPacket[]>(
            str1, [userSer, arr.map((val)=>val.id)]
        );
        let arr2 = arr.map((val)=>(val.id));
        let retArr: FileIdentReqDto[] = [];
        for (let i = 0; i < result.length; i++){
            let idxTmp = arr2.indexOf(result[i].file_serial);
            if (idxTmp === -1){this.logger.error('deletefiles_mark: '+result[i].file_serial);continue;}
            arr2.splice(idxTmp, 1);
            retArr.push(...arr.splice(idxTmp, 1));
        }
        return {arr: retArr, arrFail: arr.map((val)=>{return {id: val.id, timestamp: val.timestamp.toISOString()};})};
    }

    private async deleteFiles_recurse(conn: PoolConnection, userSer: number, arr_: Array<number>){
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

    async deleteFiles(conn: PoolConnection, userSer: number, arr_: Array<FileIdentReqDto>, from: number): Promise<FileDelResDto>{
        // deleting folders: need recursive action - mark with to_delete
        // also remove shared_def for all recursively deleted ones
        // do not delete sysdirs.
        let arr = arr_.slice();
        let arrFail: FileIdentResDto[] = [], arrFail2: FileIdentResDto[] = [];
        let result;
        ({arr, arrFail} = await this.deleteFiles_validity(conn, userSer, arr));
        ({arr, arrFail: arrFail2} = await this.deleteFiles_mark(conn, userSer, arr));
        arrFail.push(...arrFail2);
        result = arr.map((val)=>val.id);
        while (result.length > 0) {
            [result] = await this.deleteFiles_recurse(conn, userSer, result);
        }
        await this.deleteFiles_removeShares(conn, userSer);
        const { path } = await this.getDirInfo(userSer, from);
        await this.deleteFiles_toRecycle(conn, userSer, path);
        await this.deleteFiles_remove(conn, userSer);
        let retVal = new FileDelResDto();
        retVal.delarr = arr.map((val)=>{return {id: val.id, timestamp: val.timestamp.toISOString()}});
        retVal.failed = arrFail;
        return retVal;
    }

    // do not modify _arr
    async moveFiles_rename(conn: PoolConnection, userSer: number, del: boolean, parent: number, arr_: readonly {file_serial: number, file_name: string, type: string, timestamp: Date}[]){
        let arr: {file_serial: number, file_name: string, type: string, timestamp: Date}[] = [];
        arr_.forEach((val)=>{arr.push({file_serial: val.file_serial, type: val.type, file_name: val.file_name + '-2', timestamp: val.timestamp});});
        let arrFail: typeof arr = [];
        for (let i = arr_.length - 1; i >= 0 ; i--){
            if (arr_[i].file_name.length > (40-2)){
                arrFail.push(...arr.splice(i, 1));
            }
        }
        let arr2 = arr.slice();
        
        // first use arr2, change the names and remove usable items, then finally use arr to perform rename.
        let str1 = `select file_serial, file_name, type from file `
        str1 += `where user_serial=? and parent_serial=? and (type, file_name) in ? `;
        str1 += 'for update';
        while (arr2.length > 0){
            let arr3 = arr2.map((val)=>val.file_serial);
            let arrProb: typeof arr2 = [];
            let [result] = await conn.execute<RowDataPacket[]>(str1, [userSer, parent, arr2.map((val)=>[val.type, val.file_name])]);
            for (let i = 0; i < result.length; i++){
                let loc = arr3.indexOf(result[i].file_serial);
                if (loc === -1){continue;}
                arrProb.push(...arr2.splice(loc, 1));
                arr3.splice(loc, 1);
            }
            arr2 = arrProb;
            let arr_cp = arr.map((val)=>val.file_serial);
            arr2.forEach((val)=>{val.file_name + '-2'});
            for (let i = arr2.length - 1; i >= 0; i++){
                if (arr2[i].file_name.length > 40){
                    let loc = arr_cp.indexOf(arr2[i].file_serial);
                    arr.splice(loc, 1);
                    arrFail.push(...arr2.splice(i, 1));
                }
            }
        }
        
        // rename
        // unideal
        for (let i = 0; i < arr.length; i++){
            if (del){
                await conn.execute<RowDataPacket[]>(`update file set file_name=? and file_parent=? where user_serial=? and file_serial=?`,
                    [arr[i].file_name, parent, userSer, arr[i].file_serial]
                );
            } else {
                await conn.execute<RowDataPacket[]>(
                    `insert into file (usre_serial, parent_serial, type, file_name) value ?`,
                    [[userSer, parent, arr[i].type, arr[i].file_name]]
                );
            }
        }

        return {arrFail, arrRenamed: arr.map((val)=>{return {id: val.file_serial, timestamp: val.timestamp.toISOString()};})};
    }

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
        let { arr, arrFail, namechange } = await this.restoreFiles_checkPath(conn, userSer, arr_);
        let clash_toolong = (arrFail.length > 0);
        await this.restoreFiles_mark(conn, userSer, arr.map((val)=>val.id));
        await this.restoreFiles_moveFile(conn, userSer);

        return {arr, arrFail, clash_toolong, namechange};
    }

    async signupCreateDir(conn: PoolConnection, user_serial){
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

    async delUser(conn: PoolConnection, userSer: number){
        
    }
}
