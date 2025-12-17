import { BadRequestException, Body, Controller, Get, InternalServerErrorException, Logger, Put, Render, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { User } from 'src/user/user.decorator';
import { AccountGetDto } from './account-get.dto';
import { PrefsGetDto } from './prefs-get.dto';
import { MysqlService } from 'src/mysql/mysql.service';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PrefsService } from './prefs.service';
import { PrefCheckedDto } from './pref-checked.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import sharp, { Sharp } from 'sharp';
import { join } from 'node:path';
import { FilesService } from 'src/files/files.service';
import { pipeline } from 'node:stream/promises';
import busboy from 'busboy';
import type { Request } from 'express';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';

class SuccDto {
    success: boolean = true;
}

@Controller('prefs')
export class PrefsController {

    constructor(
        private readonly mysqlService: MysqlService,
        private readonly prefsService: PrefsService,
        private readonly filesService: FilesService,
    ){}

    private readonly logger = new Logger(PrefsController.name);
    
    @Get('account')
    @Render('prefs/account')
    async getAccount(@User() userSer: number): Promise<AccountGetDto> {
        let retVal = new AccountGetDto();
        await this.mysqlService.doQuery('prefs controller getAccount', async conn=>{
            let [result] = await conn.execute<RowDataPacket[]>(
                `select name, user_id, email, email2, password<>'' as pwYN, use_image from user where user_serial=?`,
                [userSer]
            );
            if (result.length <= 0){
                throw new InternalServerErrorException();
            }
            retVal.profImg = {
                cusChk: result[0].use_image === 'true' ? 'checked' : '',
                defChk: result[0].use_image === 'true' ? '' : 'checked',
            };
            retVal.profProp = {
                email: result[0].email + result[0].email2,
                id: result[0].user_id,
                name: result[0].name,
                passwordExists: result[0].pwYN === 1 ? '존재' : '존재하지 않음',
            };
            [result] = await conn.execute<RowDataPacket[]>(
                `select email, email2 from user_google where user_serial=?`,
                [userSer]
            );
            retVal.google = {
                email: result.length <= 0 ? '연동되지 않음' : result[0].email + result[0].email2,
            };
        });
        retVal = {...retVal, ...(await this.prefsService.getUserCommon(userSer, 'prefs'))};
        return retVal;
    }

    @Get()
    @Render('prefs/prefs')
    async getPrefs(@User() userSer: number): Promise<PrefsGetDto> {
        let retVal = new PrefsGetDto();
        await this.mysqlService.doQuery('prefs controller getprefs', async conn=>{
            let [result] = await conn.execute<RowDataPacket[]>(
                `select * from user where user_serial=?`,
                [userSer]
            );
            if (result.length <= 0){
                throw new InternalServerErrorException();
            }
            retVal.home = {
                bookmarkChk: result[0].home_bookmarks === 'true' ? 'checked' : '',
                hisChk: result[0].save_recent === 'true' ? 'checked' : '',
                notifChk: result[0].home_notifs === 'true' ? 'checked' : '',
                recentChk: result[0].home_files === 'true' ? 'checked' : '',
                sharedChk: result[0].home_shared === 'true' ? 'checked' : '',
            };
            retVal.inbox = {
                saveChk: result[0].auto_receive_files === 'true' ? 'checked' : '',
            }
            retVal.side = {
                bookmarkChk: result[0].side_bookmarks === 'true' ? 'checked' : '',
                sharedChk: result[0].side_shared === 'true' ? 'checked' : '',
            }
        });
        retVal = {...retVal, ...(await this.prefsService.getUserCommon(userSer, 'prefs'))};
        return retVal;
    }

    @Put('update/uploadprofimg')
    async putUpdateUploadprofimg(@User() userSer: number, @Req() req: Request): Promise<SuccDto> {
        let retVal = new SuccDto();
        retVal.success = true;
        try{
            let nullReturned = false;
            const bb = busboy({headers: req.headers, limits: {files: 1}});
            let asyncErr: Error|null = null;
            // error must not occur!
            bb.on('file', async (name: string, fstream: Readable, info: busboy.FileInfo)=>{
                try{
                    nullReturned = false;
                    const writeStream = createWriteStream(join(__dirname, `../../userfiles/profimg/${userSer}.png`));
                    const fResized = sharp().resize(120, 120, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}}).toFormat('png');
                    await pipeline(fstream, fResized, writeStream);
                } catch (err) {
                    asyncErr = err;
                    return;
                } finally {
                    nullReturned = true;
                }
            });
            await pipeline(req, bb);
            while (!nullReturned){
                await new Promise(resolve=>setImmediate(resolve));
            }
            if (asyncErr !== null){
                throw asyncErr;
            }
        } catch (err) {
            this.logger.log('error while converting profile image. see below.');
            console.log(err);
            retVal.success = false;
        }
        return retVal;
    }

    @Put('update/profimg')
    async putUpdateProfimg(@User() userSer: number, @Body() body: PrefCheckedDto): Promise<SuccDto> {
        let retVal = new SuccDto();
        retVal.success = true;
        const arrPossVal = ['default', 'custom'];
        if (!(arrPossVal.includes(body.action))){throw new BadRequestException();}
        await this.mysqlService.doQuery('prefs controller update profimg', async conn=>{
            let [result] = await conn.execute<ResultSetHeader>(
                `update user set use_image=? where user_serial=?`,
                [body.action === 'default' ? 'false' : 'true', userSer]
            );
            if (result.affectedRows <= 0){
                retVal.success = false;
            }
        });
        return retVal;
    }

    @Put('update/side')
    async putUpdateSide(@User() userSer: number, @Body() body: PrefCheckedDto): Promise<SuccDto> {
        let retVal = new SuccDto();
        retVal.success = true;
        let strColName = '';
        switch (body.action){
            case 'bookmark':
                strColName = 'side_bookmarks';
                break;
            case 'shared' :
                strColName = 'side_shared';
                break;
            default:
                throw new BadRequestException();
        }
        await this.mysqlService.doQuery('prefs controller update profimg', async conn=>{
            let [result] = await conn.execute<ResultSetHeader>(
                `update user set ${strColName}=? where user_serial=?`,
                [body.checked ? 'true' : 'false', userSer]
            );
            if (result.affectedRows <= 0){
                retVal.success = false;
            }
        });
        return retVal;
    }

    @Put('update/home')
    async putUpdateHome(@User() userSer: number, @Body() body: PrefCheckedDto): Promise<SuccDto> {
        let retVal = new SuccDto();
        retVal.success = true;
        let strColName = '';
        switch (body.action){
            case 'recent':
                strColName = 'home_files';
                break;
            case 'bookmarks' :
                strColName = 'home_bookmarks';
                break;
            case 'notifs' :
                strColName = 'home_notifs';
                break;
            case 'shared' :
                strColName = 'home_shared';
                break;
            case 'history' :
                strColName = 'save_recent';
                break;
            default:
                throw new BadRequestException();
        }
        await this.mysqlService.doQuery('prefs controller update profimg', async conn=>{
            let [result] = await conn.execute<ResultSetHeader>(
                `update user set ${strColName}=? where user_serial=?`,
                [body.checked ? 'true' : 'false', userSer]
            );
            if (result.affectedRows <= 0){
                retVal.success = false;
            }
            if (body.action === 'history' && !body.checked){
                await conn.execute(
                    `update file set last_opened='2000-01-01 00:00:00' where user_serial=?`,
                    [userSer]
                );
                await conn.execute(
                    `update shared_def set last_opened='2000-01-01 00:00:00' where user_serial_to=?`,
                    [userSer]
                );
            }
        });
        return retVal;
    }

    @Put('update/misc')
    async putUpdateMisc(@User() userSer: number, @Body() body: PrefCheckedDto): Promise<SuccDto> {
        let retVal = new SuccDto();
        retVal.success = true;
        let strColName = '';
        switch (body.action){
            case 'autorecv':
                strColName = 'auto_receive_files';
                break;
            default:
                throw new BadRequestException();
        }
        await this.mysqlService.doQuery('prefs controller update profimg', async conn=>{
            let [result] = await conn.execute<ResultSetHeader>(
                `update user set ${strColName}=? where user_serial=?`,
                [body.checked ? 'true' : 'false', userSer]
            );
            if (result.affectedRows <= 0){
                retVal.success = false;
            }
        });
        return retVal;
    }

    @Put('update/delaccount')
    async putUpdateDelaccount(@User() userSer: number){
        await this.mysqlService.doTransaction('prefs controller delaccount', async conn=>{
            await this.filesService.preDelUser(conn, userSer);
        });
    }


}
