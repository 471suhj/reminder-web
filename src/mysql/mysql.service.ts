import { Logger, Injectable, InternalServerErrorException, HttpException } from '@nestjs/common';
import mysql, { Pool, PoolConnection } from 'mysql2/promise';

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

    writeError(servicename: string, err: Error): void{
        this.logger.error('mysql error occured at ' + servicename + '. see below.');
        console.log(err);
    }

    async doTransaction(servicename: string, process: (connection: PoolConnection)=>Promise<void>): Promise<void>{
        const conn: PoolConnection = await (await this.getSQL()).getConnection();
        try{
            console.log(await conn.execute('start transaction'));
            await process(conn);
            console.log(await conn.execute('commit'));
        } catch (err) {
            this.writeError(servicename, err);
            if (err instanceof HttpException){
                throw err;
            }
            throw new InternalServerErrorException();
        } finally {
            conn.release();
        }
    }

    async doQuery(servicename: string, process: (connection: Pool)=>Promise<void>): Promise<void>{
        const conn: Pool = await this.getSQL();
        try{
            await process(conn);
        } catch (err) {
            this.writeError(servicename, err);
            if (err instanceof HttpException){
                throw err;
            }
            throw new InternalServerErrorException();
        }
    }

}
