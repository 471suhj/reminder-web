import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

@Injectable()
export class HashPasswordService {
    constructor(){}

    async getHash(): Promise<string>{
        const prmRandByte = promisify(randomBytes);
        return (await prmRandByte(24)).toString('base64');
    }
}
