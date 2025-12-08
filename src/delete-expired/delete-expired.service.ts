import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MysqlService } from 'src/mysql/mysql.service';
import mysql from 'mysql2/promise';

@Injectable()
export class DeleteExpiredService {
    constructor(private mysqlService: MysqlService){}

    private readonly logger = new Logger(DeleteExpiredService.name);

    @Cron('0 0 */6 * * *') // session, old_id, user
    async DeleteExpiredSeldom(): Promise<void>{
        this.logger.log('start: cron job - seldom');
        const pool: mysql.Pool = await this.mysqlService.getSQL();
        try{
            await pool.execute('delete from session where timestampdiff(day, last_updated, current_timestamp) >= 7');
            await pool.execute('delete from old_id where timestampdiff(month, last_updated, current_timestamp) >= 6');
            await pool.execute('delete from user where timestampdiff(month, last_updated, current_timestamp) >= 3');
        } catch (err) {
            this.logger.error('delete expired service mysql error. see below.');
            console.log(err);
        } finally {
            this.logger.log('end: cron job - seldom');
        }
    }

    @Cron('0 */15 * * * *') // google_consent, email_verification, permdel recycles.
    async DeleteExpiredFreq(): Promise<void>{
        this.logger.log('start: cron job - freq');
        const pool: mysql.Pool = await this.mysqlService.getSQL();
        try{
            await pool.execute('delete from google_consent where timestampdiff(minute, last_updated, current_timestamp) >= 10');
            await pool.execute('delete from email_verification where timestampdiff(minute, last_updated, current_timestamp) >= 5');
            await pool.execute('delete from recycle where timestampdiff(month, last_renamed, current_timestamp) >= 1');
        } catch (err) {
            this.logger.error('delete expired service mysql error. see below.');
            console.log(err);
        } finally {
            this.logger.log('end: cron job - freq');
        }
    }
}
