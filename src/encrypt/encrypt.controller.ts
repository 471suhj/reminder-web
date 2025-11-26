import { Controller, Get} from '@nestjs/common';
import { SendPWKeyDto } from './send-pwkey.dto';
import { EncryptService } from './encrypt.service';

@Controller('auth')
export class EncryptController {
    constructor(private encryptService: EncryptService){

    }

    @Get('encr')
    async sendPWEncrypt(): Promise<SendPWKeyDto>{
        return {value: await this.encryptService.getPublicPWKey()};
    }

    
}
