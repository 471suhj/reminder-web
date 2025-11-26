import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { GetPWDto } from './get-pw.dto';
import { EncryptService } from '../encrypt/encrypt.service';
import { EncryptError } from '../encrypt/encrypt-error';
import { RespondLoginDto } from './respond-login.dto';

@Controller('auth')
export class AuthController {
    constructor(private encryptService: EncryptService){}

    @Post('auth')
    async authPassword (@Body() body: GetPWDto): Promise<RespondLoginDto>{
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
        console.log(body.password);
        return resLogin;
    }
}
