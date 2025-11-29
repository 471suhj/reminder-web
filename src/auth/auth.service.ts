import { Injectable, Logger } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import mysql from 'mysql2/promise';
import { HashPasswordService } from '../hash-password/hash-password.service';

@Injectable()
export class AuthService {

    private readonly logger = new Logger('auth service');

    constructor(private mysqlService: MysqlService, private hashPasswordService: HashPasswordService){}

    async AuthUser(ID: string, PW: string): Promise<false | number>{ // max_int of number is greater than int unsigned of mysql
        const pool: mysql.Pool = await this.mysqlService.getSQL();
        const [result] = await pool.execute<mysql.RowDataPacket[]>('select user_serial, password, salt from user where user_id=?', [ID]);
        if (result.length <= 0){
            return false;
        } else if (result.length >= 2){
            this.logger.error('mysql has more than one record with user_id=' + ID);
        }
        const boolAuth = await this.hashPasswordService.comparePW(PW, result[0]['salt'], result[0]['password']);
        if (boolAuth){
            return result[0]['user_serial'] as number;
        } else {
            return false;
        }
    }
}
