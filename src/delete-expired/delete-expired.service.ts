import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MysqlService } from 'src/mysql/mysql.service';
import mysql, { RowDataPacket } from 'mysql2/promise';
import { MongoService } from 'src/mongo/mongo.service';
import { ObjectId } from 'mongodb';
import { FilesService } from 'src/files/files.service';

@Injectable()
export class DeleteExpiredService {
    constructor(
        private readonly mysqlService: MysqlService,
        private readonly mongoService: MongoService,
        private readonly filesService: FilesService
    ){}

    private readonly logger = new Logger(DeleteExpiredService.name);

    @Cron('0 0 */6 * * *') // session, old_id, user, notifs
    async DeleteExpiredSeldom(): Promise<void>{
        this.logger.log('start: delete-expired cron job - seldom');
        const pool: mysql.Pool = await this.mysqlService.getSQL();
        try{
            await pool.execute('delete from session where timestampdiff(day, last_updated, current_timestamp) >= 7');
            await pool.execute('delete from old_id where timestampdiff(month, last_updated, current_timestamp) >= 6');
            let [result] = await pool.execute<RowDataPacket[]>(`select user_serial from user where user_deleted='true' and timestampdiff(month, last_updated, current_timestamp) >= 1`);
            for (const itm of result){
                await this.filesService.delUser(itm.user_serial);
            }
            await this.mongoService.getDb().collection('notification')
                .deleteMany({_id: {$lt: ObjectId.createFromTime(Math.floor((new Date()).getTime()/1000) - 100 * 24 * 3600)}});
        } catch (err) {
            this.logger.error('delete expired service mysql error. see below.');
            console.log(err);
        } finally {
            this.logger.log('end: delete-expired cron job - seldom');
        }
    }

    @Cron('0 */15 * * * *') // google_consent, email_verification, permdel recycles, friend request.
    async DeleteExpiredFreq(): Promise<void>{
        this.logger.log('start: delete-expired cron job - freq');
        const pool: mysql.Pool = await this.mysqlService.getSQL();
        try{
            await pool.execute('delete from google_consent where timestampdiff(minute, last_updated, current_timestamp) >= 10');
            await pool.execute('delete from email_verification where timestampdiff(minute, last_updated, current_timestamp) >= 5');
            await pool.execute('delete from recycle where timestampdiff(month, last_renamed, current_timestamp) >= 1');
            await pool.execute('delete from friend_req where timestampdiff(day, last_updated, current_timestamp) >= 20');
        } catch (err) {
            this.logger.error('delete expired service mysql error. see below.');
            console.log(err);
        } finally {
            this.logger.log('end: delete-expired cron job - freq');
        }
    }
}
