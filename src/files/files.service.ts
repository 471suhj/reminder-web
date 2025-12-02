import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { RowDataPacket, Pool } from 'mysql2/promise';
import { FilesGetDto } from './files-get.dto';
import { PrefsService } from 'src/prefs/prefs.service';
import { SysdirType } from './sysdir.type';

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
        let strSql2 = strSelect2 + strWhere2 + strOrder + `for share`;
        if (mode !== 'recycle'){
            return [strSql1, strSql2];
        } else {
            return [strSql1];
        }
    }

    generateDelete(mode: SysdirType['val'], itmCnt: number){
        if (!SysdirType.arr.includes(mode)){throw new BadRequestException();}
        let strDel: Array<string> = [];
        let strWhere: Array<string> = [];
        // beware of unauthorized deletes!
        if (mode === 'files'){
            strDel.push(`select file_serial from file `);
            strWhere.push(`where user_serial=? and file_parent=? `);
            strDel.push(`update file set to_delete=? `);
            strWhere.push(`where file_serial in ? `);
            strDel.push(`delete from shared_def `);
            strWhere.push(`where user_serial_from=? and file_serial in (select file_serial from file where user_serial=? and to_delete<>'na' for share) `);
            strDel.push(`insert into recycle (user_serial, parent_serial, type, file_name, file_serial, last_modified, del_type) `);
            strWhere.push(`value ? `);
            strDel.push(`delete from file `);
            strWhere.push(`where user_serial=? and to_delete<>'na' and issys<>'true'`);
            // deleting folders: need recursive action - mark with to_delete
            // also remove shared_def for all recursively deleted ones
            // do not delete sysdirs.
            throw new InternalServerErrorException(); // do not use this function yet
        } else if (mode === 'inbox'){
            throw new InternalServerErrorException();
        } else if (mode === 'bookmarks'){
            strDel.push(`update shared_def set bookmarked='false' `);
            strWhere.push(`where user_serial_to=? and file_serial=? `);
            strDel.push(`update file set bookmarked='false' `);
            strWhere.push(`where user_serial=? and file_serial=? `);
        } else if (mode === 'shared'){
            strDel.push(`delete from shared_def `);
            strWhere.push(`where user_serial_to=? and file_serial in (${'? ,'.repeat(itmCnt).slice(0, -2)}) `);
        } else if (mode === 'recycle'){
            strDel.push(`delete from recycle `);
            strWhere.push(`where user_serial=? and file_serial in (${'? ,'.repeat(itmCnt).slice(0, -2)}) `);
        } else {throw new BadRequestException();}
        for (let i = 0; i < strWhere.length; i++){
            if (strDel[i].slice(0, 6) === 'select'){strWhere[i] += 'for share';}
        }
        return [strDel, strWhere];
    }

    signupCreateDir(user_serial){

    }
}
