import { Logger, Injectable } from '@nestjs/common';
import { generateKeyPair, RSAKeyPairOptions, privateDecrypt, constants, KeyObject } from 'node:crypto';
import { promisify } from 'node:util';
import { EncryptError } from './encrypt-error';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class EncryptService {
    #keyOptions: RSAKeyPairOptions<'jwk', 'pem'> = {
        modulusLength: 4096,
        publicKeyEncoding: {type: 'spki', format: 'jwk'},
        privateKeyEncoding: {type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase : process.env.ENCR_PASS}
    };
    #publicPWKey: KeyObject;
    #privatePWKey: KeyObject;
    #updating: boolean = true;

    private readonly logger = new Logger('encrypt.service');

    constructor(){
        console.log('start: EncryptService');
        this.createPublicPWKey();
        console.log('end: EncryptService');
    }

    @Cron('0 0 3 * * *')
    private async createPublicPWKey(): Promise<void>{
        this.logger.log('cron job: begin: creating new public key at encrypt.service');
        const prmKeyPair = promisify(generateKeyPair);
        try{
            const {publicKey, privateKey} = await prmKeyPair('rsa', this.#keyOptions);// object, string
            this.#updating = true;
            this.#publicPWKey = publicKey;
            this.#privatePWKey = privateKey;
            return;
        } catch (err) {
            this.logger.log('encrypt.service.ts createpublickey generatekeypair error: see below');
            console.log(err);
            return;
        } finally {
            this.#updating = false;
            this.logger.log('cron job: done: creating new public key at encrypt.service');
        }
    }

    async getPublicPWKey(): Promise<KeyObject>{
        while (this.#updating){
            await new Promise((resolve, _)=>{setImmediate(resolve)});;
        }
        return this.#publicPWKey;
    }

    async decryptPW(pubKey: KeyObject, encrPW: string): Promise<string>{
        while (this.#updating){
            await new Promise((resolve, _)=>{setImmediate(resolve)});;
        }
        if (JSON.stringify(pubKey) !== JSON.stringify(this.#publicPWKey)){
            throw new EncryptError("expired");
        }
        try{
            return privateDecrypt({key: this.#privatePWKey, passphrase: process.env.ENCR_PASS, oaepHash: 'sha256', padding: constants.RSA_PKCS1_OAEP_PADDING}, Buffer.from(encrPW, 'base64')).toString();
        } catch (err) {
            throw new EncryptError("internal", err);
        }
    }
}
