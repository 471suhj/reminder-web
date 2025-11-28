import { Logger, Controller, Post, Put, Body, HttpException, HttpStatus } from '@nestjs/common';
import { RegisterDto } from './register.dto';
import { CheckidDto } from './checkid.dto';
import { VerifyEmailDto } from './verify-email.dto';
import { EmailDto } from './email.dto';
import { HashPasswordService } from '../hash-password/hash-password.service';
import { EncryptService } from '../encrypt/encrypt.service';
import { MysqlService } from '../mysql/mysql.service';
import { KeyObject } from 'node:crypto';
import mysql from 'mysql2/promise';

@Controller('signup')
export class SignupController {
    constructor(
        private hashPasswordService: HashPasswordService, 
        private encryptService: EncryptService,
        private mysqlService: MysqlService
    ){}

    private readonly logger = new Logger('signup');

    @Post('register')
    async registerUser(@Body() body: RegisterDto): Promise<{success: boolean, message?: string}>{
        if (!body.nokey) {
            body.password = await this.encryptService.decryptPW(body.key as KeyObject, body.password);
        }
        body.id = body.id.normalize();
        body.password = body.password.normalize();
        body.username = body.username.normalize();

        const salt: string = await this.hashPasswordService.getSalt();
        const pwEncr: string = (await this.hashPasswordService.getHash(body.password, salt)).toString();
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        try{
            const [results, fields] = await sqlPool.execute('insert into user (user_id, name, password, email) value (?, ?, ?, ?)', [body.id, body.username, pwEncr, body.email]);
            console.log('user registered');
            console.log(results);
            return {success: true};
        } catch (err) {
            this.logger.error('error on signup register. see below.');
            console.log(err);
            return {success: false, message: '입력이 잘못되었거나 서버 오류가 발생했습니다.'};
        }
    }

    @Put('checkid')
    async checkId(@Body() body: CheckidDto): Promise<{valid: boolean, alreadyExists?: boolean, message?: string}>{
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        body.id = body.id.normalize();
        try{
            const result1 = await sqlPool.execute<mysql.RowDataPacket[]>('select user_id from user where user_id=?', [body.id]);
            const result2 = await sqlPool.execute<mysql.RowDataPacket[]>('select user_id from old_id where user_id=?', [body.id]);
            if (result1.length > 0 || result2.length > 0){
                if  (result1.length >= 2 || result2.length >= 2){
                    this.logger.error('duplicate values in mysql user_id with id=' + body.id);
                }
                return {valid: false, alreadyExists: true};
            } else {
                return {valid: true};
            }
        } catch (err){
            this.logger.error('signup checkid mysql error. see below');
            console.log(err);
            throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('email')
    async emailCode(@Body() body: EmailDto): Promise<"">{
        const strCode: string = await this.hashPasswordService.getVerifiCode();
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        try {
            await sqlPool.execute(
                'insert into email_verification (email, code) value (?, ?) on duplicate key update code=?',
                [body.email, strCode, strCode]);
            return "";
        } catch (err) {
            this.logger.error('signup email mysql error. see below');
            console.log(err);
            throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Put('verify')
    async verifyCode(@Body() body: VerifyEmailDto): Promise<{success: boolean}>{
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        try {
            const result = await sqlPool.execute<mysql.RowDataPacket[]>('select code from email_verification where email=?', [body.email]);
            if (result.length <= 0){
                throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
            } else {
                if (result.length > 1){
                    this.logger.error('duplicate in email_verification with email=' + body.email);
                }
                if (result[0]['code'] === body.code){
                    return {success: true};
                } else {
                    return {success: false};
                }
            }
        } catch (err) {
            this.logger.error('signup email verification mysql error. see below.');
            console.log(err);
            throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


}
