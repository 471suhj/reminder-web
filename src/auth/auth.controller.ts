import { Controller, Post, Body, HttpException, HttpStatus, Res, Logger } from '@nestjs/common';
import { GetPWDto } from './get-pw.dto';
import { EncryptService } from '../encrypt/encrypt.service';
import { EncryptError } from '../encrypt/encrypt-error';
import { RespondLoginDto } from './respond-login.dto';
import { HashPasswordService } from '../hash-password/hash-password.service';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { MysqlService } from '../mysql/mysql.service';
import mysql from 'mysql2/promise';

@Controller('auth')
export class AuthController {
    constructor(
        private encryptService: EncryptService,
        private hashPasswordService: HashPasswordService,
        private authService: AuthService,
        private mysqlService: MysqlService
    ){}

    private readonly logger = new Logger('auth controller')

    @Post('auth')
    async authPassword (@Body() body: GetPWDto, @Res({ passthrough: true }) response: Response): Promise<RespondLoginDto>{
        const resLogin: RespondLoginDto = new RespondLoginDto();
        if (!body.nokey && body.key){
            try{
                body.password = await this.encryptService.decryptPW(body.key, body.password);
            } catch (err) {
                if (err instanceof EncryptError){
                    if (err.encr_type === 'expired'){
                        resLogin.success = false;
                        resLogin.expired = true;
                    } else if (err.encr_type === 'internal'){
                        console.log('internal error during password decryption. check encrypt service.');
                        console.log(err.encr_data);
                        resLogin.success = false;
                        resLogin.message = "서버 내부의 오류로 로그인에 실패했습니다.";
                    }
                } else {
                    throw err;
                }
            }
        } else if (!body.nokey) {
            throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
        }

        let alreadyFalse: boolean = false;
        if (body.id.length > 25){
            body.id = body.id.slice(0, 25);
            alreadyFalse = true;
        }
        if (body.password.length > 30){
            body.password = body.password.slice(0, 30);
            alreadyFalse = true;
        }

        body.id = body.id.normalize();
        body.password = body.password.normalize();
        const userSerial = await this.authService.AuthUser(body.id, body.password);
        if (userSerial && !alreadyFalse){
            let strToken: string = await this.hashPasswordService.getToken();
            try{
                const pool: mysql.Pool = await this.mysqlService.getSQL();
                await pool.execute('insert into session (user_serial, token) value (?, ?)', [userSerial, strToken])
            } catch (err) {
                this.logger.error('mysql error at auth controller. see below.');
                console.log(err);
                throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
            }
            response.cookie('userToken', strToken);
            resLogin.success = true;
        } else {
            resLogin.success = false;
        }
        
        if (alreadyFalse){
            resLogin.success = false;
        }

        return resLogin;
    }
}
