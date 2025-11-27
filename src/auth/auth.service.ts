import { Injectable } from '@nestjs/common';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';

@Injectable()
export class AuthService {
    constructor(){}

    private async hashPW(PW: string, salt: string): Promise<string>{
        const prmScrypt = promisify(scrypt);
        return (await prmScrypt(PW, salt, 100) as Buffer).toString('base64');
    }

    async authenticate_user(ID: string, PW: string): Promise<string|null>{
        await this.hashPW(PW.normalize(), 'cat');
        return null;
    }
}
