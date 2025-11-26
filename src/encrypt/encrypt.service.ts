import { Injectable } from '@nestjs/common';
import { MysqlService } from '../mysql/mysql.service';
import { generateKeyPair, RSAKeyPairOptions, privateDecrypt, constants, KeyObject } from 'node:crypto';
import { promisify } from 'node:util';
import { EncryptError } from './encrypt-error';

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

    constructor(private mysqlService: MysqlService){
        console.log('start: EncryptService');
        this.createPublicPWKey();
        console.log('end: EncryptService');
    }

    private async createPublicPWKey(): Promise<void>{
        //const mysql = await this.mysqlService.getSQL();
        const prmKeyPair = promisify(generateKeyPair);
        try{
            const {publicKey, privateKey} = await prmKeyPair('rsa', this.#keyOptions);// object, string
            this.#publicPWKey = publicKey;
            this.#privatePWKey = privateKey;
            console.log(privateKey)
            return;
        } catch (err){
            console.log('encrypt.service.ts createpublickey generatekeypair error: see below');
            return;
        } finally {
            this.#updating = false;
        }
        /*try {
            const [results, fields] = await mysql.query(
                ''
            );

            console.log(results); // results contains rows returned by server
            console.log(fields); // fields contains extra meta data about results, if available
        } catch (err) {
            console.log(err);
        }*/
    }

    async getPublicPWKey(): Promise<KeyObject>{
        while (this.#updating){
            Promise.resolve();
        }
        return this.#publicPWKey;
    }

    async decryptPW(pubKey: string, encrPW: string): Promise<string>{
        while (this.#updating){
            Promise.resolve();
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