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
import axios from 'axios';

@AuthDec('anony-only')
@Controller('auth')
export class AuthController {

    constructor(
        private encryptService: EncryptService,
        private authService: AuthService,
        private mysqlService: MysqlService,
        private httpService: HttpService,
        private signupService: SignupService,
    ){
        this.oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 
            'https://localhost:3000/auth/google/response'
        );
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
            await this.authService.getToken(userSerial, response);
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

    @Get('google/response')
    async googleRes(@Query('error') error, @Query('code') code, @Query('state') state, @Res({ passthrough: true }) response: Response){
        if (!this.authService.googleCheckParams(error, code, state, response)){
            return;
        }

        if (!(await this.authService.googleCheckState(state, response))){
            return;
        }

        try{
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            if (tokens === undefined || tokens.scope === undefined){
                throw new Error('tokens or tokens.scope is undefined. tokens: ' + String(tokens));
            }
            if (!tokens.scope.includes('https://www.googleapis.com/auth/userinfo.email')){
                this.authService.googleAuthFailed(response);
                return;
            }

            let username: string = '사용자';
            let res: axios.AxiosResponse;
            try{
                res = await this.httpService.axiosRef.get('https://www.googleapis.com/oauth2/v2/userinfo',
                    {headers: {'Authorization': 'Bearer ' + tokens.access_token}}
                );
            } catch (err) {
                this.logger.error('http error while fetching info at auth google response. see below');
                console.log(err);
                this.authService.googleAuthFailed(response);
                return;
            }
            if (typeof res.data['name'] === 'string'){
                username = res.data['name'];
            }
            const signupRes = await this.signupService.registerUser('', '', username, res.data['email'], 'google', {tokens: tokens, ...res.data});
            if (!signupRes.success){
                this.logger.error('error signing up google user. message:' + String(signupRes.message));
                this.authService.googleAuthFailed(response);
                return;
            }
            if (signupRes.serial <= 0){
                this.logger.error('at auth google response, signup response serial is zero.');
                throw new InternalServerErrorException();
            }
            await this.authService.getToken(signupRes.serial, response);
            // name, id(필수), email(필수), verified_email(tf)
            response.redirect('/home');
        } catch (err) {
            this.authService.googleAuthFailed(response);
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
                await pool.execute('insert into google_consent (token) value (?) on duplicate key update token=?', [state, state]);
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
