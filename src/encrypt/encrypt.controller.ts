import { Controller, Get} from '@nestjs/common';
import { SendPWKeyDto } from './send-pwkey.dto';
import { EncryptService } from './encrypt.service';
import { AuthDec } from 'src/auth/auth.decorator';

@AuthDec('anony-only')
@Controller('auth')
export class EncryptController {
    constructor(private encryptService: EncryptService){

    }

    @Get('encr')
    async sendPWEncrypt(): Promise<SendPWKeyDto>{
        return {value: await this.encryptService.getPublicPWKey()};
    }

    
}
