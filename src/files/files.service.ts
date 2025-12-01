import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { RowDataPacket, Pool } from 'mysql2/promise';

@Injectable()
export class FilesService {
    constructor(private mysqlService: MysqlService){}

    private readonly logger = new Logger(FilesService.name);

    async getUserRoot(userSer: number){
        const pool: Pool = await this.mysqlService.getSQL();
        try {
            let [result] = await pool.execute<RowDataPacket[]>(
                "select file_serial from file where user_serial=? and type='sysdir' and file_name='files'", [userSer]);
            if (result.length <= 0){
                throw new Error('files service mysql: root folder cannot be found userid=' + userSer);
            }
            return Number(result[0].user_serial);
        } catch (err) {
            this.logger.error('files service mysql error. see below.');
            console.log(err);
            throw new InternalServerErrorException();
        }
    }

    async getPath(userSer: number, fileId: number){
        await this.mysqlService.doTransaction('files service getPath', async function(conn){
            let [result] = await conn.execute<RowDataPacket[]>('select ')

        })
    }
}
