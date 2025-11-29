import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { HashPasswordService } from 'src/hash-password/hash-password.service';
import { MysqlService } from 'src/mysql/mysql.service';
import mysql from 'mysql2/promise';

@Injectable()
export class SignupService {
    constructor(
        private mysqlService: MysqlService,
        private hashPasswordService: HashPasswordService,
    ){}

    private readonly logger = new Logger(SignupService.name);

    async registerUser(id: string, pw: string, username: string, email: string, mode?: 'google', googleObj?: any)
    : Promise<{success: boolean, message?: string}>{
        id = id.normalize();
        id = id.toLowerCase();
        pw = pw.normalize();
        username = username.normalize();
        email = email.toLowerCase();

        const salt: string = await this.hashPasswordService.getSalt();
        let pwEncr: string = '';
        if (pw !== ''){
            pwEncr = (await this.hashPasswordService.getHash(pw, salt)).toString();
        }

        
        try{
            let retVal: {success: boolean, message?: string, user_serial?: number} = {success: false};
            await this.mysqlService.doTransaction('signup register', async function(conn){
                if (mode === 'google'){
                    id = ('google-' + email).slice(0, 20).toLowerCase();
                }
                let [result1] = await conn.execute<mysql.RowDataPacket[]>('select user_serial from old_id where user_id=? for share', [id]);
                let [result2] = await conn.execute<mysql.RowDataPacket[]>('select user_serial from user where user_id=? or email=? for update', [id, email]);
                if (result1.length > 0 || result2.length > 0){
                    if (mode === 'google'){
                        const origIdLen = id.length;
                        const regId = id + '[0-9]*';
                        [result1] = await conn.execute<mysql.RowDataPacket[]>(
                            'select user_id from user, old_id where user.user_id regexp ? or old_id.user_id regexp ? order by user_id desc limit 1 for update', [regId, regId]);
                        id = id + String(Number(result1[0]['user_id'].slice(origIdLen, 25)) + 1);
                        if (id.length > 25){
                            this.logger.error('signup service: id number exceeded limit! id=' + id);
                            throw new InternalServerErrorException();
                        }
                    } else {
                        retVal.success = false;
                        retVal.message = '사용할 수 없는 아이디입니다.';
                        return;
                    }
                }
                let [result] = await conn.execute<mysql.RowDataPacket[]>('insert into user (user_id, name, password, email) value (?, ?, ?, ?)', [id, username, pwEncr, email]);
                if (mode === 'google'){
                    [result] = await conn.execute<mysql.RowDataPacket[]>('select user_serial from user where user_id=? for share', [id]);
                    await conn.execute<mysql.RowDataPacket[]>('insert into user_google (user_serial, token, refresh_token, google_id) value (?,?,?,?)',
                        [Number(result[0]['user_serial']), googleObj.tokens.access_token, googleObj.tokens.refresh_token, googleObj.id]);
                }
                retVal.success = true;
            });
            return retVal;
        } catch (err) {
            if (!(err instanceof InternalServerErrorException)){
                this.logger.error('error on signup register. see below.');
                console.log(err);
                throw new InternalServerErrorException();
            }
            return {success: false, message: '입력이 잘못되었거나 서버 오류가 발생했습니다.'};
        }
        
    }
}
