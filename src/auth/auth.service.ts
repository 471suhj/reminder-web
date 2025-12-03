import { Injectable, Logger } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import mysql from 'mysql2/promise';
import { HashPasswordService } from '../hash-password/hash-password.service';
import type { Response } from 'express';

export class setCookie{
    static setTokenCookie(response: Response, value: string){
        // lax: allow direct login from remote, without first being redirected to home
        response.cookie('__Host-Http-userToken', value, {maxAge: 7*24*60*60*1000, httpOnly: true, secure: true, sameSite: 'lax'});
    }
}

@Injectable()
export class AuthService {

    private readonly logger = new Logger('auth service');

    constructor(private mysqlService: MysqlService, private hashPasswordService: HashPasswordService){}

    async AuthUser(ID: string, PW: string): Promise<false | number>{ // max_int of number is greater than int unsigned of mysql
        const pool: mysql.Pool = await this.mysqlService.getSQL();
        if (ID.length < 7){
            return false;
        }
        if (PW.length < 7){
            return false;
        }
        ID = ID.normalize();
        ID = ID.toLowerCase();
        const [result] = await pool.execute<mysql.RowDataPacket[]>('select user_serial, password, salt from user where user_id=?', [ID]);
        if (result.length <= 0){
            return false;
        } else if (result.length >= 2){
            this.logger.error('mysql has more than one record with user_id=' + ID);
        }
        const boolAuth = await this.hashPasswordService.comparePW(PW, result[0]['salt'], result[0]['password']);
        if (boolAuth){
            return result[0]['user_serial'] as number;
        } else {
            return false;
        }
    }

    googleAuthFailed(response: Response): void{
        response.redirect('/auth/google/failed');
        return;
    }

    googleCheckParams(error, code, state, response): boolean{

        if ((error !== undefined) || (state === undefined) || (code === undefined)){
            this.googleAuthFailed(response);
            this.logger.log('auth google response: error received: ', error);
            return false;
        }
    
        try{
            code = String(code);
            state = String(state);
            if (code.length <= 0 || state.length <= 0){throw new Error('empty params');}
        } catch (err) {
            this.logger.error('failed to parse query params at auth google response. see below.');
            console.log('code:', code);
            console.log('state:', state);
            this.googleAuthFailed(response);
            return false;
        }

        return true;
    }

    async googleCheckState(state, response): Promise<boolean>{
        let success: boolean = false;
        this.mysqlService.doTransaction('auth google response', async function(conn: mysql.PoolConnection){
            const [result] = await conn.execute<mysql.RowDataPacket[]>('select token from google_consent where token=? for update', [state]);
            if (result.length > 0){
                await conn.execute<mysql.RowDataPacket[]>('delete from google_consent where token=? order by last_updated asc limit 1', [state]);
                success = true;
            } else {
                success = false;
            }
        });
        if (!success){
            this.googleAuthFailed(response);
        }

        return success;
    }

    async getToken(userSerial, response: Response): Promise<void>{
        let strToken: string = await this.hashPasswordService.getToken();
        await this.mysqlService.doTransaction('auth controller', async function(conn){
            let result: mysql.RowDataPacket[];
            do{
                [result] = await conn.execute<mysql.RowDataPacket[]>('select user_serial from session where token=? for share', [strToken]);
            } while (result.length > 0)
            console.log(await conn.execute('insert into session (user_serial, token) value (?, ?)', [userSerial, strToken]));
        });
        setCookie.setTokenCookie(response, strToken);
    }
}