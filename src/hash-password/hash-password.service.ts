import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createCipheriv, createDecipheriv, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import type { Cipher, Decipher } from 'node:crypto';
import { promisify } from 'node:util';

@Injectable()
export class HashPasswordService {
    #emailivA: Buffer;
    #emailkeyA: Buffer;
    #emailivB: Buffer;
    #emailkeyB: Buffer;
    #emailIncr: number =  0;
    #emailCipherUpdating: boolean = true;
    private readonly logger = new Logger(HashPasswordService.name);

    constructor(){
        this.updateEmailCipher();
    }

    @Cron('0 */30 * * * *')
    async updateEmailCipher(){
        this.logger.log('start cron: updateEmailCipher');
        this.#emailCipherUpdating = true;
        this.#emailIncr++;
        this.#emailIncr = this.#emailIncr % 1000;
        this.#emailivB = this.#emailivA;
        this.#emailkeyB = this.#emailkeyA;
        try{
            this.#emailkeyA = await this.getByte(16);
            this.#emailivA = await this.getByte(16);
        } catch (err) {
            this.logger.error('error on updateemailcipher. see below.');
            console.log(err);
        } finally {
            this.#emailCipherUpdating = false;
            this.logger.log('end cron: updateEmailCipher');
        }
    }
    
    async encryptEmail(addr: string): Promise<string>{
        while(this.#emailCipherUpdating){
            await new Promise((resolve) => {setImmediate(resolve)});
        }
        const emailCipheriv: Cipher = createCipheriv('aes-128-cbc', this.#emailkeyA, this.#emailivA);
        // as a result, emails verified too long ago are invalidated
        return String(this.#emailIncr).padStart(3, '0') + Buffer.concat([emailCipheriv.update(addr, 'utf-8'), emailCipheriv.final()]).toString('base64');
    }
    
    async decryptEmail(addr: string): Promise<string|false>{
        while(this.#emailCipherUpdating){
            await new Promise((resolve) => {setImmediate(resolve)});
        }
        let incr: number;
        try{
            incr = Number(addr.slice(0, 3));
            addr = addr.slice(3);
            let emailDecipheriv: Decipher;
            if (incr === this.#emailIncr){
                emailDecipheriv = createDecipheriv('aes-128-cbc', this.#emailkeyA, this.#emailivA);
            } else if ((incr === this.#emailIncr - 1) || (incr === this.#emailIncr + 999)){
                emailDecipheriv = createDecipheriv('aes-128-cbc', this.#emailkeyB, this.#emailivB);
            } else {
                return false;
            }
            return Buffer.concat([emailDecipheriv.update(addr, 'base64'), emailDecipheriv.final()]).toString('utf-8');
        } catch (err) {
            console.log(err);
            return false;
        }

    }

    async getHash(pw: string, salt: string): Promise<Buffer>{
        const prmScrypt = promisify(scrypt);
        return (await prmScrypt(pw, Buffer.from(salt), 32) as Buffer);
    }

    private async getByte(len: number): Promise<Buffer>{
        const prmRandByte = promisify(randomBytes);
        return (await prmRandByte(len) as Buffer);
    }
    async getToken(): Promise<string>{
        return (await this.getByte(24)).toString('base64');
    }

    async getSalt(): Promise<string>{
        return (await this.getByte(16)).toString('base64');
    }

    async getVerifiCode(): Promise<string>{
        const prmInt = promisify(randomInt);
        return String(await prmInt(100000000)).padStart(8, '0');
    }

    async comparePW(PW: string, salt: string, compareto: string): Promise<boolean>{
        const pwHash: Buffer = await this.getHash(PW, salt);
        try {
            const ret = timingSafeEqual(pwHash, Buffer.from(compareto, 'base64'));
            return ret;
        } catch (err) {
            console.log(err);
            return false;
        }
    }
    
}
