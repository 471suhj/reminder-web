import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

@Injectable()
export class HashPasswordService {
    constructor(){}

    async getHash(pw: string, salt: string): Promise<Buffer>{
        const prmScrypt= promisify(scrypt);
        return (await prmScrypt(pw, Buffer.from(salt), 32) as Buffer);
    }
    
    private async getByte(len: number): Promise<string>{
        const prmRandByte = promisify(randomBytes);
        return (await prmRandByte(len) as Buffer).toString('base64');
    }
    async getToken(): Promise<string>{
        return await this.getByte(24);
    }

    async getSalt(): Promise<string>{
        return await this.getByte(16);
    }

    async getVerifiCode(): Promise<string>{
        return await this.getByte(4);
    }

    async comparePW(PW: string, salt: string, compareto: string): Promise<boolean>{
        const pwHash: Buffer = await this.getHash(PW, salt);
        return timingSafeEqual(pwHash, Buffer.from(compareto));
    }
    
}
