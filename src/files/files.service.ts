import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { RowDataPacket, Pool, PoolConnection } from 'mysql2/promise';
import { FilesGetDto } from './files-get.dto';
import { PrefsService } from 'src/prefs/prefs.service';
import { SysdirType } from './sysdir.type';
import { FileDelResDto } from './file-del-res.dto';
import { FileIdentResDto } from './file-ident-res.dto';
import { FileIdentReqDto } from './file-ident-req.dto';
import { FilesArrDto } from './files-arr.dto';

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

    async deleteFiles(conn: PoolConnection, userSer: number, arr_: readonly FileIdentReqDto[], from: number): Promise<FileDelResDto>{
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
        await this.deleteFiles_toRecycle(conn, userSer, path);
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
            //re-insert files
            if (del){
                await conn.execute<RowDataPacket[]>(str6, [result2]);
            }
            // change file names
            await conn.execute<RowDataPacket[]>(str3, [userSer, to]);
            // update file types
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
