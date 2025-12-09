import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RowDataPacket } from 'mysql2';
import { MysqlService } from 'src/mysql/mysql.service';

@Injectable()
export class CheckIntegrityService {
    constructor(private mysqlService: MysqlService){}

    private readonly logger = new Logger(CheckIntegrityService.name);

    @Cron('0 0 0 * * *') // friend_mono-friend integrity
    async DeleteExpiredSeldom(): Promise<void>{
        this.logger.log('start: check-integrity cron job - seldom');
        await this.mysqlService.doTransaction('check-integrity cron-friend-mono integrity', async (conn)=>{
            let [res_mono] = await conn.execute<RowDataPacket[]>(
                `select count(*) as cnt from friend_mono for share`
            );
            let [res_full] = await conn.execute<RowDataPacket[]>(
                `select count(*) as cnt from friend for share`
            );
            if (res_mono[0].cnt !== 2 * res_full[0].cnt){
                this.logger.error('friend_mono count is not the double of friend count!');
            }
        });
        // other jobs should use other queries rather than using the transaction above
        this.logger.log('end: check-integrity cron job - seldom');
    }
}
