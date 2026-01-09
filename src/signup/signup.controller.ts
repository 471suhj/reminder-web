import { Logger, Controller, Post, Put, Body, HttpException, HttpStatus, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { RegisterDto } from './register.dto';
import { CheckidDto } from './checkid.dto';
import { VerifyEmailDto } from './verify-email.dto';
import { EmailDto } from './email.dto';
import { HashPasswordService } from '../hash-password/hash-password.service';
import { SigninEncryptService } from '../hash-password/signin-encrypt.service';
import { MysqlService } from '../mysql/mysql.service';
import { KeyObject } from 'node:crypto';
import mysql, { RowDataPacket } from 'mysql2/promise';
import { AuthDec } from 'src/auth/auth.decorator';
import { SignupService } from './signup.service';
import { EncryptError } from 'src/hash-password/encrypt-error';
import { AwsService } from 'src/aws/aws.service';
import { ListTenantsCommand, ListTenantsCommandInput, MessageRejected, SendEmailCommand } from '@aws-sdk/client-sesv2';

@AuthDec('anony-only')
@Controller('signup')
export class SignupController {
    constructor(
        private readonly hashPasswordService: HashPasswordService, 
        private readonly signinEncryptService: SigninEncryptService,
        private readonly mysqlService: MysqlService,
        private readonly signupService: SignupService,
        private readonly awsService: AwsService,
    ){}

    private readonly logger = new Logger('signup');

    @Post('register')
    async registerUser(@Body() body: RegisterDto): Promise<{success: boolean, message?: string, expired?: boolean}>{
        try {
            if (!body.nokey) {
                body.password = await this.signinEncryptService.decryptPW(body.key as KeyObject, body.password);
            }
        } catch (err) {
            if ((err instanceof EncryptError) && (err.encr_type === 'expired')){
                return {success: false, expired: true};
            } else {
                throw err;
            }
        }
        const normPW = body.password.normalize();
        if ((normPW.length > 30) || (normPW.length < 7)){
            throw new BadRequestException();
        }
        let cat;
        if ((cat = await this.hashPasswordService.decryptEmail(body.emailkey)) !== body.email.normalize()){
            console.log(cat);
            return {success: false, message: '이메일 주소의 인증을 확인하는 것에 실패했습니다.\n만약 이 오류가 처음 발생했다면 다시 이메일 인증번호를 받고 인증을 진행해 보십시오.'};
        }
        return await this.signupService.registerUser(body.id, normPW, body.username, body.email);
    }

    @Put('checkid')
    async checkId(@Body() body: CheckidDto): Promise<{valid: boolean, alreadyExists?: boolean, message?: string}>{
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        body.id = body.id.normalize();
        body.id = body.id.toLowerCase();
        if (body.id.slice(0, 7) === 'google-'){
            return {valid: false, alreadyExists: true};
        }
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
    }

    @Post('email')
    async emailCode(@Body() body: EmailDto): Promise<{success: boolean, message?: string}>{
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        body.email = body.email.toLowerCase();
        // let [result] = await sqlPool.execute<mysql.RowDataPacket[]>('select user_serial from user where email=?', [body.email]);
        // if (result.length > 0){
        //     return {success: false, message: "이미 사용중인 이메일입니다."};
        // }
        let [result] = await sqlPool.execute<RowDataPacket[]>(
            'select email from email_blocked where email=? and email2=?',
            [body.email.slice(0,65), body.email.slice(65)]
        );
        if (result.length > 0){
            return {success: false, message: '수신 거부된 이메일입니다. 수신 거부를 해제하려면 comtrams@outlook.com으로 문의하십시오.'};
        }
        const strCode: string = await this.hashPasswordService.getVerifiCode();
        await sqlPool.execute(
            'insert into email_verification (email, email2, code) value (?,?,?) on duplicate key update code=?',
            [body.email.slice(0,65), body.email.slice(65), strCode, strCode]
        );
        let emailMsg = `ComphyCat Reminder Online의 인증 번호는\n\n${strCode}\n\n입니다.`;
        emailMsg += '\n\n\n만약 인증 번호를 요청하지 않으셨다면, 수신 거부를 할 수 있습니다. ';
        emailMsg += '수신 거부 및 거부 해제를 위해서는 comtrams@outlook.com으로 연락해 주시기 바랍니다.';
        const emailParams = {
            Content: {
                Simple: {
                    Body: {
                        Text: {
                            Data: emailMsg,
                            Charset: 'UTF-8'
                        }
                    },
                    Subject: {
                        Data: 'ComphyCat Reminder Online 인증 번호',
                        Charset: 'UTF-8'
                    }
                }
            },
            Destination: {
                ToAddresses: [body.email]
            },
            FromEmailAddress: 'noreply@comphycat.uk'
        };
        const emailCmd = new SendEmailCommand(emailParams);
        try {
            await this.awsService.client.send(emailCmd);
        } catch (err) {
            console.log(err);
            if (err instanceof MessageRejected){
                if (err.message.slice(0, 30) === 'Email address is not verified.'){
                    return {success: false, message: 'Email sender is sandboxed, and could not send the email.'};
                }
            }
            return {success: false, message: '서버 자체의 오류로 이메일 전송을 실패했습니다.'};
        } 
        this.logger.log(`verification code for ${body.email}: ${strCode}`);
        return {success: true};
    }

    @Put('verify')
    async verifyCode(@Body() body: VerifyEmailDto): Promise<{success: boolean, key?: string, failmessage?: string}>{
        const sqlPool: mysql.Pool = await this.mysqlService.getSQL();
        body.email = body.email.toLowerCase();
        // const [result] = await sqlPool.execute<mysql.RowDataPacket[]>
        // ('select code from email_verification where email=? and email2=?', [body.email.slice(0, 65), body.email.slice(65)]);
        // if (result.length <= 0){
        //     return {success: false, failmessage: '인증 번호가 만료되었습니다.'};
        // } else {
        //     if (result.length > 1){
        //         this.logger.error('duplicate in email_verification with email=' + body.email);
        //     }
        //     if (result[0]['code'] === body.code){
                return {success: true, key: await this.hashPasswordService.encryptEmail(body.email)};
        //     } else {
        //         return {success: false};
        //     }
        // }
    }


}
