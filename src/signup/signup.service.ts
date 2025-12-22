import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { HashPasswordService } from 'src/hash-password/hash-password.service';
import { MysqlService } from 'src/mysql/mysql.service';
import mysql from 'mysql2/promise';
import { FilesService } from 'src/files/files.service';

@Injectable()
export class SignupService {
    constructor(
        private readonly mysqlService: MysqlService,
        private readonly hashPasswordService: HashPasswordService,
        private readonly filesService: FilesService,
    ){}

    private readonly logger = new Logger(SignupService.name);

    async registerUser(id: string, pw: string, username: string, email: string, mode?: 'google', googleObj?: any)
    : Promise<{success: boolean, message?: string, serial: number}>{
        id = id.normalize();
        id = id.toLowerCase();
        pw = pw.normalize();
        username = username.normalize();
        email = email.toLowerCase();

        try{
            let retVal: {success: boolean, message?: string, serial: number} = {success: false, serial: 0};
            await this.mysqlService.doTransaction('signup register', async (conn, rb)=>{
                let updateinfo = false;
                let result: mysql.RowDataPacket[];
                if (mode === 'google'){
                    [result] = await conn.execute<mysql.RowDataPacket[]>('select google_id from user_google where google_id=? for update', [googleObj.id]);
                    if (result.length > 0){
                        updateinfo = true;
                        if (googleObj.tokens.refresh_token){
                            await conn.execute('update user_google set token=?, refresh_token=?, email=?, email2=?, email_verified=? where google_id=?',
                                [googleObj.tokens.access_token, googleObj.tokens.refresh_token, email.slice(0, 65), email.slice(65), String(googleObj.verified_email), googleObj.id]);
                        } else {
                            await conn.execute('update user_google set token=?, email=?,email2=?, email_verified=? where google_id=?',
                                [googleObj.tokens.access_token, , email.slice(0, 65), email.slice(65), String(googleObj.verified_email), googleObj.id]);
                        }
                    } else {
                        if (googleObj.tokens.refresh_token === undefined){
                            this.logger.error('signup service: google signup error: no refresh_token provided');
                            googleObj.tokens.refresh_token = '';
                        }
                    }
                }
                if (!updateinfo){
                    if (mode === 'google'){
                        id = ('google-' + email).slice(0, 20).toLowerCase();
                    }
                    [result] = await conn.execute<mysql.RowDataPacket[]>('select user_id from all_id where user_id=? for share', [id]);
                    if (result.length > 0){
                        if (mode === 'google'){
                            const origIdLen = id.length;
                            const regId = id + '[0-9]*';
                            [result] = await conn.execute<mysql.RowDataPacket[]>(
                                'select user_id from all_id where user_id regexp ? order by user_id desc limit 1 for update', [regId]);
                                id = id + String(Number(result[0]['user_id'].slice(origIdLen, 25)) + 1);
                            if (id.length > 25){
                                this.logger.error('signup service: id number exceeded limit! id=' + id);
                                throw new InternalServerErrorException();
                            }
                        } else {
                            rb.rback = true;
                            retVal.success = false;
                            retVal.message = '사용할 수 없는 아이디입니다.';
                            return; // caution: return to just outside of transaction!
                        }
                    }
                    const salt: string = await this.hashPasswordService.getSalt();
                    let pwEncr: string = '';
                    if (pw !== ''){
                        pwEncr = (await this.hashPasswordService.getHash(pw, salt)).toString('base64');
                    }
                    await conn.execute(
                        'insert into user (user_id, name, password, email, email2, salt) value (?,?,?,?,?,?)', [id, username, pwEncr, email.slice(0, 65), email.slice(65), salt]);
                }
                if (mode === 'google' && updateinfo){
                    [result] = await conn.execute<mysql.RowDataPacket[]>('select user_serial from user_google where google_id=? for share', [googleObj.id]);                
                } else {
                    [result] = await conn.execute<mysql.RowDataPacket[]>('select user_serial from user where user_id=? for share', [id]);
                }
                if (!updateinfo){
                    await this.filesService.signupCreateDir(conn, result[0].user_serial)
                }
                retVal.serial = Number(result[0].user_serial);
                if (mode === 'google' && !updateinfo){
                    await conn.execute<mysql.RowDataPacket[]>('insert into user_google (user_serial, token, refresh_token, google_id, email, email2, email_verified) value (?,?,?,?,?,?,?)',
                        [retVal.serial, googleObj.tokens.access_token, googleObj.tokens.refresh_token, googleObj.id, email.slice(0, 65), email.slice(65), String(googleObj.verified_email)]);
                }
                retVal.success = true;
            });
            // transaction 내부에서 return하는 경우가 있음. 따라서 이 곳에서 작업하는 경우 주의
            return retVal;
        } catch (err) {
            if (!(err instanceof InternalServerErrorException)){
                this.logger.error('error on signup register. see below.');
                console.log(err);
                throw new InternalServerErrorException();
            }
            return {success: false, message: '입력이 잘못되었거나 서버 오류가 발생했습니다.', serial: 0};
        }
        
    }
}
