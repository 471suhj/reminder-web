import { Logger, Controller, Post, Put, Body, HttpException, HttpStatus, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { RegisterDto } from './register.dto';
import { CheckidDto } from './checkid.dto';
import { VerifyEmailDto } from './verify-email.dto';
import { EmailDto } from './email.dto';
import { HashPasswordService } from '../hash-password/hash-password.service';
import { EncryptService } from '../encrypt/encrypt.service';
import { MysqlService } from '../mysql/mysql.service';
import { KeyObject } from 'node:crypto';
import mysql from 'mysql2/promise';
import { AuthDec } from 'src/auth/auth.decorator';
import { SignupService } from './signup.service';

@AuthDec('anony-only')
@Controller('signup')
export class SignupController {
    constructor(
        private hashPasswordService: HashPasswordService, 
        private encryptService: EncryptService,
        private mysqlService: MysqlService,
        private signupService: SignupService,
    ){}

    private readonly logger = new Logger('signup');

    @Post('register')
    async registerUser(@Body() body: RegisterDto): Promise<{success: boolean, message?: string}>{
        if (!body.nokey) {
            body.password = await this.encryptService.decryptPW(body.key as KeyObject, body.password);
        }
        return await this.signupService.registerUser(body.id, body.password, body.username, body.email);
    }

    @Put('checkid')
    async checkId(@Body() body: CheckidDto): Promise<{valid: boolean, alreadyExists?: boolean, message?: string}>{
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        body.id = body.id.normalize();
        body.id = body.id.toLowerCase();
        if (body.id.slice(0, 7) === 'google-'){
            return {valid: false, alreadyExists: true};
        }
        try{
            const [result1] = await sqlPool.execute<mysql.RowDataPacket[]>('select user_id from user where user_id=?', [body.id]);
            const [result2] = await sqlPool.execute<mysql.RowDataPacket[]>('select user_id from old_id where user_id=?', [body.id]);
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
    async emailCode(@Body() body: EmailDto): Promise<{success: boolean, message?: string}>{
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        body.email = body.email.toLowerCase();
        try {
            const [result] = await sqlPool.execute<mysql.RowDataPacket[]>('select user_serial from user where email=?', [body.email]);
            if (result.length > 0){
                return {success: false, message: "이미 사용중인 이메일입니다."};
            }
            const strCode: string = await this.hashPasswordService.getVerifiCode();
            await sqlPool.execute(
                'insert into email_verification (email, code) value (?, ?) on duplicate key update code=?',
                [body.email, strCode, strCode]);
            return {success: true};
        } catch (err) {
            this.logger.error('signup email mysql error. see below');
            console.log(err);
            throw new InternalServerErrorException();
        }
    }

    @Put('verify')
    async verifyCode(@Body() body: VerifyEmailDto): Promise<{success: boolean}>{
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        body.email = body.email.toLowerCase();
        try {
            const [result] = await sqlPool.execute<mysql.RowDataPacket[]>('select code from email_verification where email=?', [body.email]);
            if (result.length <= 0){
                throw new BadRequestException();
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
