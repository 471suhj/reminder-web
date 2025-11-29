import { Controller, Post, Body, Res, Logger, BadRequestException, Get, Req, Query, InternalServerErrorException, Render } from '@nestjs/common';
import { GetPWDto } from './get-pw.dto';
import { EncryptService } from '../encrypt/encrypt.service';
import { EncryptError } from '../encrypt/encrypt-error';
import { RespondLoginDto } from './respond-login.dto';
import { HashPasswordService } from '../hash-password/hash-password.service';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { MysqlService } from '../mysql/mysql.service';
import mysql, { RowDataPacket } from 'mysql2/promise';
import { AuthDec } from './auth.decorator';
import { google } from 'googleapis';
import { randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { HttpService } from '@nestjs/axios';
import { SignupService } from 'src/signup/signup.service';

@AuthDec('anony-only')
@Controller('auth')
export class AuthController {

    constructor(
        private encryptService: EncryptService,
        private hashPasswordService: HashPasswordService,
        private authService: AuthService,
        private mysqlService: MysqlService,
        private httpService: HttpService,
        private signupService: SignupService,
    ){
        this.oauth2Client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, 
                'https://localhost:3000/auth/google/response');
    }

    oauth2Client: OAuth2Client;
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
        } else if (!body.nokey || (body.nokey && body.key)) {
            throw new BadRequestException();
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
        body.id = body.id.toLowerCase();
        body.password = body.password.normalize();
        const userSerial = await this.authService.AuthUser(body.id, body.password);
        if (userSerial && !alreadyFalse){
            let strToken: string = await this.hashPasswordService.getToken();
            await this.mysqlService.doTransaction('auth controller', async function(conn){
                let result: mysql.RowDataPacket[];
                do{
                    [result] = await conn.execute<mysql.RowDataPacket[]>('select user_serial from session where token=? for update', [strToken]);
                } while (result.length > 0)
                console.log(await conn.execute('insert into session (user_serial, token) value (?, ?)', [userSerial, strToken]));
            });
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

    @Get('google/failed')
    @Render('failed')
    getGoogleAuthFailed(): {message: string}{
        return {message: '서비스 연동에 실패했습니다.'};
    }

    googleAuthFailed(response: Response): void{
        response.redirect('/auth/google/failed');
        return;
    }

    @Get('google/response')
    async googleRes(@Query('error') error, @Query('code') code, @Query('state') state, @Res({ passthrough: true }) response: Response){
        if ((error !== undefined) || (state === undefined) || (code === undefined)){
            this.googleAuthFailed(response);
            this.logger.log('auth google response: error received: ', error);
            return;
        }

        try{
            code = String(code);
            state = String(state);
        } catch (err) {
            this.logger.error('failed to parse query params at auth google response. see below.');
            console.log('code:', code);
            console.log('state:', state);
            this.googleAuthFailed(response);
            return;
        }

        let success: boolean = false;
        this.mysqlService.doTransaction('auth google response', async function(conn: mysql.PoolConnection){
            const [result] = await conn.execute<RowDataPacket[]>('select token from google_consent where token=? for update', [state]);
            if (result.length > 0){
                await conn.execute<RowDataPacket[]>('delete from google_consent where token=? order by last_updated asc limit 1', [state]);
                success = true;
            } else {
                success = false;
            }
        });
        if (!success){
            this.googleAuthFailed(response);
            return;
        }
        try{
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            if (tokens === undefined || tokens.scope === undefined){
                throw new Error('tokens or tokens.scope is undefined. tokens: ' + String(tokens));
            }
            if (!tokens.scope.includes('https://www.googleapis.com/auth/userinfo.email')){
                this.googleAuthFailed(response);
                return;
            }
            let username: string = '사용자';
            let res;
            try{
                res = await this.httpService.axiosRef.get('https://www.googleapis.com/oauth2/v2/userinfo',
                    {headers: {'Authorization': 'Bearer ' + tokens.access_token}}
                );
            } catch (err) {
                this.logger.error('http error while fetching info at auth google response. see below');
                console.log(err);
                this.googleAuthFailed(response);
                return;
            }
            if (typeof res['name'] === 'string'){
                username = res['name'];
            }
            const signupRes = await this.signupService.registerUser('', '', username, res['email'], 'google', {tokens: tokens, ...res});
            if (!signupRes.success){
                this.logger.error('error signing up google user. message:' + String(signupRes.message));
                this.googleAuthFailed(response);
                return;
            }
            // name, id(필수), email(필수), verified_email(tf)
            response.redirect('/home');
        } catch (err) {
            this.googleAuthFailed(response);
            this.logger.error('auth google response: failed to get token. see below');
            console.log(err);
            return;
        }

    }

    @Get('google')
    async googleReq(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void>{
        try{
            
            const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];
            const state = randomBytes(32).toString('hex');
            const pool: mysql.Pool = await this.mysqlService.getSQL();
            try{
                const [result] = await pool.execute<RowDataPacket[]>('insert into google_consent (token) value (?)', [state]);
            } catch (err) {
                this.mysqlService.writeError('auth google', err);
                throw new InternalServerErrorException();
            }
    
            const authorizationUrl = this.oauth2Client.generateAuthUrl({access_type: 'offline',
                scope: scopes, include_granted_scopes: true, state: state});
            response.redirect(authorizationUrl);
        } catch (err) {
            this.logger.error('error at auth google. see below.');
            console.log(err);
            throw new InternalServerErrorException();
        }
    }
}
