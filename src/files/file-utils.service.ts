import { BadRequestException, forwardRef, Inject, InternalServerErrorException, Logger } from "@nestjs/common";
import { MysqlService } from "src/mysql/mysql.service";
import { FilesService } from "./files.service";
import { FileResolutionService } from "./file-resolution.service";
import { SysdirType } from "./sysdir.type";
import { RowDataPacket } from "mysql2";
import { Connection, PoolConnection } from "mysql2/promise";
import { MongoService } from "src/mongo/mongo.service";
import { FiledatColDto } from "src/mongo/filedat-col.dto";
import fs, { FileHandle } from "node:fs/promises";
import { Document } from "mongodb";
import { join } from "node:path";
import { Readable } from "node:stream";

export class FileUtilsService {

    constructor(
        private readonly mysqlService: MysqlService,
        private readonly mongoService: MongoService,
        @Inject(forwardRef(()=>FilesService)) private readonly filesService: FilesService,
        @Inject(forwardRef(()=>FileResolutionService)) private readonly fileResolutionService,
    ) {}

    private readonly logger = new Logger(FileUtilsService.name);

    // should not be blocking or blocked
    async getUserRoot(userSer: number, type: SysdirType['val']){
        const pool = await this.mysqlService.getSQL();
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
                    throw new BadRequestException('파일이 존재하지 않거나 접근할 수 없습니다.');
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

    translateColumnBase(val: string, mode: SysdirType['val']){
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

    async uploadMongo(fileSer: number, stream: Readable, userSer: number){
        const availVer = ['0.2', '0.3'];
        let buf = '';
        let streamDone = false;
        let finishCalled = false;
        let asyncErr: Error|null = null;
        let objDoc = new FiledatColDto();
        objDoc.serial = fileSer;
        objDoc.user_serial = userSer;
        const dirpath = join(__dirname, `../../filesys/${fileSer}`);
        const tmpVar = {buf: '', phase: 'M', idx: 0, fh: null, doc: objDoc, pth: dirpath};
        await fs.mkdir(dirpath, {});

        let inspected = false;
        stream.setEncoding('utf8');
        // make sure that no errors are thrown
        stream.on('readable', async ()=>{
            if (asyncErr !== null){stream.resume(); return;} // so that readable will not be called unneccessarily
            try{
                streamDone = false;
                let chunk: string;
                while ((chunk = stream.read()) !== null){
                    // buf: at first, store all data to validate 'AAMPGRMB'
                    // after validation, used only to prevent sending arrays ending in ''
                    // all arrTmp's first element must not contain the beginning of each element (splitted by '&'). insert '' if this is the case.
                    buf += chunk;
                    const arrTmp = buf.split('&');
                    if (!inspected) {
                        if (arrTmp.length > 1 || arrTmp[0].length > 30) {
                            inspected = true;
                            if (arrTmp[0].slice(1, 17) !== 'AAMPGRMBFileVer='){
                                throw new BadRequestException('잘못된 형식의 파일입니다.');
                            }
                            if (availVer.includes(arrTmp[0].slice(17))){ // inspected
                                objDoc.type = 'rmb' + arrTmp[0].slice(17) as typeof objDoc.type;
                            } else {
                                throw new BadRequestException('지원되지 않는 버전의 파일입니다.');
                            }
                            arrTmp[0] = ''; // first element must not contain the beginning of each element splitted by '&'
                        } else {
                            return;
                        }
                    }
                    buf = arrTmp.at(-1) ?? '';
                    if (arrTmp.at(-1) === ''){
                        arrTmp.pop();
                        buf = '&';
                    }
                    if (arrTmp.length > 0) {
                        await this.uploadMongo_processFileStream(arrTmp, tmpVar);
                    }
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
            if (!inspected) {
                throw new BadRequestException('잘못된 형식의 파일입니다.');
            }
            await this.uploadMongo_processFileStream([], tmpVar);
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

    private async uploadMongo_processFileStream(arr: string[], tmpVar: {buf: string, phase: string, idx: number, fh: null|FileHandle, doc: FiledatColDto, pth: string}){
        // note: empty string should be passed to commitFileStream only to close the currently open phase.
        // empty string should never be passed in other cases.
        if (arr.length <= 0){ // empty array is passed only after all the contents are read
            this.uploadMongo_commitFileStream('', tmpVar);
            return;
        }
        if (arr[0] !== '') {
            await this.uploadMongo_commitFileStream(arr[0], tmpVar);
        }
        for (let i = 1; i < arr.length; i++){
            let str = arr[i];
            // newbuf: fill the new content
            // buf: store previous value if needed
            // after each 'complete' value, send '' to mark an end
            // consider 4 cases: ['...', '...&N...'], ['...', '...&A...'], ['...', '&A...'], ['...', '&N...']
            // the other 2 cases are prevented in advance: ['...&', 'A...'], ['...&', 'N...']
            if (str.slice(0, 1) === 'A'){
                tmpVar.buf += '&';
                tmpVar.buf += str.slice(1);
            } else {
                await this.uploadMongo_commitFileStream('', tmpVar);
                if (str !== '') {
                    await this.uploadMongo_commitFileStream(str, tmpVar);
                }
            }
        }
    }

    private async uploadMongo_commitFileStream(bufnew: string, tmpVar: {buf: string, phase: string, idx: number, fh: null|FileHandle, doc: FiledatColDto, pth: string}){
        const availProp = ['FontSize', 'Interval', 'RemStart', 'RemEnd'];
        if (bufnew === ''){ // A: end phase. note that two consequent '' may arrive.
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
                        tmpVar.doc.metadata[pairVal.shift()!] = pairVal.join('=');
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
            tmpVar.phase = bufnew.slice(0, 1);
            bufnew = bufnew.slice(1);
            tmpVar.buf = '';
            switch (tmpVar.phase){
                case 'N':
                    tmpVar.fh = await fs.open(join(tmpVar.pth, String(++(tmpVar.idx))), 'wx');
                    tmpVar.doc.arrlen = tmpVar.idx;
                    break;
            }
        }
        // C: continue the phase
        switch (tmpVar.phase){
            case 'M':
                tmpVar.buf = '';
                break;
            case 'P':
                tmpVar.buf += bufnew;
                if (tmpVar.buf.length > 100){
                    throw new BadRequestException('잘못된 길이의 속성값입니다.');
                }
                break;
            case 'N':
                if (tmpVar.fh === null){
                    throw new InternalServerErrorException();
                }
                await tmpVar.fh.appendFile(tmpVar.buf + bufnew);
                tmpVar.buf = '';
                break;
            default:
                throw new BadRequestException('지원되지 않는 속성입니다.');
        }
    }

}