import { Logger, Injectable } from '@nestjs/common';
import mysql from 'mysql2/promise';

@Injectable()
export class MysqlService {
    #pool: mysql.Pool;
    #connected: boolean = false;

    private readonly logger = new Logger('mysql service');

    constructor(){
        console.log('start: MysqlService');
        this.initSQL();
        this.getSQL();
        console.log('end: MysqlService');
    }
    
    private async initSQL(): Promise<void> {
        try{
            this.#pool = await mysql.createPool({
                host: 'localhost',
                user: 'user',
                database: 'reminder_web',
                password: process.env.MYSQL_PW,
            });
            this.#connected = true;
            this.logger.log('mysql connected');
        } catch (err){
            this.logger.error('mysql.service error: see below');
            console.log(err);
        }
    }

    async getSQL(): Promise<mysql.Pool>{
        while (!this.#connected){
            await new Promise(function(resolve, _){setImmediate(resolve)});
        }
        return this.#pool;;
    }
}
