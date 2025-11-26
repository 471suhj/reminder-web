import { Injectable } from '@nestjs/common';
import mysql from 'mysql2/promise';

@Injectable()
export class MysqlService {
    #connection: mysql.Connection;
    #connected: boolean = false;

    constructor(){
        console.log('start: MysqlService');
        this.initSQL();
        console.log('end: MysqlService');
    }
    
    private async initSQL(): Promise<void> {
        try{
            this.#connection = await mysql.createConnection({
                host: 'localhost',
                user: 'user',
                database: 'reminder_web',
                password: process.env.MYSQL_PW
            });
            this.#connected = true;
        } catch (err){
            console.log('mysql.service error: see below');
            console.log(err);
        }
    }

    async getSQL(): Promise<mysql.Connection>{
        while (!this.#connected){
            Promise.resolve(); 
        }
        return this.#connection;
    }
}
