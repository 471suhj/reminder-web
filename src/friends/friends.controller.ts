import { Controller, Delete, Get, Post, Put, Body, Query, ParseIntPipe, Logger, BadRequestException, Param, Render } from '@nestjs/common';
import { FriendListDto } from './friend-list.dto';
import { User } from 'src/user/user.decorator';
import { SortModeDto } from 'src/files/sort-mode.dto';
import { FileDelResDto } from 'src/files/file-del-res.dto';
import { UserCommonDto } from 'src/user/user-common.dto';
import { DataSource } from 'typeorm';
import { MysqlService } from 'src/mysql/mysql.service';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { FilesService } from 'src/files/files.service';
import { PoolConnection } from 'mysql2/promise';
import { PrefsService } from 'src/prefs/prefs.service';
import { ProfileGetDto } from './profile-get.dto';
import { InboxSaveDto } from 'src/files/inbox-save.dto';
import { MongoService } from 'src/mongo/mongo.service';
import { NotifColDto } from 'src/mongo/notif-col.dto';

@Controller('friends')
export class FriendsController {

    constructor(
        private readonly dataSource: DataSource,
        private readonly mysqlService: MysqlService,
        private readonly filesService: FilesService,
        private readonly prefsService: PrefsService,
        private readonly mongoService: MongoService,
    ){}

    @Get()
    @Render('friends/friends')
    async getFriends(@User(ParseIntPipe) userSer: number): Promise<UserCommonDto>{
        return await this.prefsService.getUserCommon(userSer, 'friends');
    }

    @Put()
    async renameFriends(
        @User(ParseIntPipe) userSer: number,
        @Body() body: {id: number, newname: string}
    ): Promise<{success: boolean, failmessage?: string}>{
        let result: ResultSetHeader;
        if (body.newname.length > 25){
            return {success: false, failmessage: '닉네임은 25자를 초과할 수 없습니다.'};
        }
        await this.mysqlService.doQuery('friends controller rename', async (conn)=>{
            [result] = await conn.execute<ResultSetHeader>(
                `update friend_mono set nickname=? where user_serial_from=? and user_serial_to=?`,
                [body.newname, body.id, userSer]
            );
        });
        if (result!.affectedRows <= 0){ // valid only under client_found_rows flag
            return {success: false, failmessage: '등록되지 않은 친구 또는 존재하지 않는 친구입니다.'};
        }
        return {success: true};
    }

    @Delete()
    async deleteFriends(
        @User(ParseIntPipe) userSer: number,
        @Body() body: {sort: SortModeDto, last: number, friends: Array<number>}
    ): Promise<FileDelResDto>{
        await this.filesService.resolveFriendLoadmore(userSer, body.friends, body.last, body.sort);
        await this.mysqlService.doTransaction('friends controller delete', async (conn)=>{
            await this.filesService.deleteFriends(conn, userSer, body.friends);
        });
        let retVal = new FileDelResDto();
        retVal.delarr = body.friends.map(val=>{return {id: val, timestamp: ''};});
        retVal.failed = [];
        return retVal;
    }

    @Put('add') // caution: id here means user_id
    async addFriends(@User(ParseIntPipe) userSer: number, @Body() body: {id: string}): Promise<{success: boolean, failmessage?: string}>{
        // only undeleted friends, and those who are not friends yet.
        let retVal: {success: boolean, failmessage?: string} = {success: true};
        let friendSer = 0;
        await this.mysqlService.doTransaction('friends controller delete', async (conn, rb)=>{
            let [result] = await conn.execute<RowDataPacket[]>(
                `select user_serial from user where user_id=? and user_deleted='false' for share`,
                [body.id]
            );
            if (result.length <= 0){
                retVal.success = false;
                retVal.failmessage = '존재하지 않는 사용자입니다.';
                rb.rback = true;
                return;
            }
            friendSer = result[0].user_serial;
            [result] = await conn.execute<RowDataPacket[]>(
                `select user_serial_to from friend_mono where user_serial_to=? and user_serial_from=? for update`,
                [userSer, friendSer]
            );
            if (result.length > 0){
                retVal.success = false;
                retVal.failmessage = '이미 등록된 사용자입니다.';
                rb.rback = true;
                return;
            }
            let [result2] = await conn.execute<ResultSetHeader>(
                `delete from friend_req where user_serial_to=? and user_serial_from=? for update`,
                [userSer, friendSer]
            );
            if (result2.affectedRows > 0){
                this.setttleFriend(conn, userSer, friendSer);
                retVal.success = true;
                return;
            }
            [result] = await conn.execute<RowDataPacket[]>(
                `select user_serial_to from friend_req where user_serial_to=? and user_serial_from=? and timestampdiff(day, last_updated, current_timestamp) < 3 for update`,
                [friendSer, userSer]
            );
            if (result.length > 0){
                retVal.success = false;
                // 요청은 승낙/거부/보류(메시지 삭제 포함). 거부시 알림, 요청 내역이 있는 경우 3일 이후 재요청 가능, 재요청시 기간 갱신, 20일 후 요청 내역 삭제
                retVal.failmessage = '이미 요청이 전송된 사용자입니다.';
                rb.rback = true;
                return;
            }
            [result] = await conn.execute<RowDataPacket[]>(
                `insert into friend_req (user_serial_to, user_serial_from) value (?, ?) on duplicate key update last_updated=current_timestamp`,
                [friendSer, userSer] // order is important
            );
            retVal.success = true;
        });
        if (retVal.success){
            const doc: NotifColDto = {data: {sender_ser: userSer}, read: false, to: friendSer, type: 'friend_request', urlArr: []};
            await this.mongoService.getDb().collection('notification').insertOne(doc);
        }
        return retVal;
    }

    // checking for user_deleted should be done beforehand
    private async setttleFriend(conn: PoolConnection, userSer: number, id: number){
        await conn.query(`insert into friend_mono (user_serial_to, user_serial_from) values (?), (?)`,
            [[userSer, id], [id, userSer]]);
        await conn.query(`insert into friend (user_serial_to, user_serial_from) value (?)`,
            [[userSer, id]]);
    }

    @Put('consent')
    async consentFriend(@User(ParseIntPipe) userSer: number, @Body() body: InboxSaveDto): Promise<{success: boolean, failmessage?: string}>{
        // only undeleted friends, and those who are not friends yet.
        let retVal: {success: boolean, failmessage?: string} = {success: true};
        await this.mysqlService.doTransaction('friends controller consent', async (conn, rb)=>{
            let [result1] = await conn.execute<RowDataPacket[]>(
                `select user_serial from user where user_serial=? and user_deleted='false' for share`,
                [body.id]
            )
            if (result1.length <= 0){
                rb.rback = true;
                retVal.success = false;
                retVal.failmessage = '존재하지 않는 사용자입니다.';
                return;
            }
            let [result] = await conn.execute<ResultSetHeader>(
                `delete from friend_req where user_serial_from=? and user_serial_to=?`,
                [body.id, userSer]
            );
            if (result.affectedRows > 0){
                await this.setttleFriend(conn, userSer, body.id);
                retVal.success = true;
                return;
            } else {
                rb.rback = true;
                retVal.success = false;
                retVal.failmessage = '기간이 만료된 요청으로 친구 추가에 실패했습니다. 친구로 추가하려면 다시 요청을 보내야 합니다.';
                return;
            }
        });
        if (retVal.success){
            const doc: NotifColDto = {data: {sender_ser: userSer}, read: false, to: body.id, type: 'friend_request_accepted', urlArr: []};
            await this.mongoService.getDb().collection('notification').insertOne(doc);
        }
        return retVal;
    }

    @Put('reject')
    async rejectFriend(@User(ParseIntPipe) userSer: number, @Body() body: InboxSaveDto): Promise<{success: boolean, failmessage?: string}>{
        let retVal: {success: boolean, failmessage?: string} = {success: true};
        await this.mysqlService.doTransaction('friends controller reject', async (conn, rb)=>{
            let [result] = await conn.execute<ResultSetHeader>(
                `delete from friend_req where user_serial_from=? and user_serial_to=?`,
                [body.id, userSer]
            );
        });
        if (retVal.success){
            const doc: NotifColDto = {data: {sender_ser: userSer}, read: false, to: body.id, type: 'friend_request_rejected', urlArr: []};
            await this.mongoService.getDb().collection('notification').insertOne(doc);
        }
        return retVal;
    }

    @Get('list') // for fileupload
    async getFriendList(@User(ParseIntPipe) userSer: number): Promise<FriendListDto>{
        let retVal = new FriendListDto();
        await this.mysqlService.doQuery('friends controller list', async conn=>{
            let str1 = `select user_serial_from, nickname, name `;
            str1 += `from friend_mono inner join user on friend_mono.user_serial_from=user.user_serial `;
            str1 += `where user_serial_to=? `;
            let [result] = await conn.execute<RowDataPacket[]>(
                str1, [userSer]
            );
            retVal.arr = result.map(val=>{
                return {
                    nickname: val.nickname === '' ? val.name : val.nickname,
                    username: val.name,
                    id: val.user_serial_from,
                };
            })
        });
        return retVal;
    }

    @Get(':id')
    async getProfile(@User(ParseIntPipe) userSer: number, @Param('id', ParseIntPipe) userid: number): Promise<ProfileGetDto>{
        let retVal = new ProfileGetDto();
        retVal = {...retVal, ...await this.prefsService.getUserCommon(userSer, 'friends')};
        let str1 = `select date_added, user_id, user_serial, name, nickname from friend_mul inner join user on friend_mul.user_serial_from=user.user_serial `;
        str1 += `where user_serial_from=? and user_serial_to=?`;
        await this.mysqlService.doQuery('friends controller get profile', async conn=>{
            let [result] = await conn.execute<RowDataPacket[]>(
                str1, [userid, userSer]
            );
            if (result.length <= 0){
                throw new BadRequestException();
            }
            let itm = result[0];
            retVal.dateAdded = itm.date_added;
            retVal.dateShared = '헤당 없음';
            retVal.friendID = itm.user_id;
            retVal.friendImg = '/graphics/profimg?id=' + itm.user_serial;
            retVal.friendName = itm.name
            retVal.friendNickname = itm.nickname === '' ? itm.name : itm.nickname;
            retVal.profId = itm.user_serial;
            [result] = await conn.execute<RowDataPacket[]>(
                `select date_shared from shared_def where (user_serial_to=? and user_serial_from=?) or (user_serial_to=? and user_serial_from=?) order by date_shared limit 1`,
                [userSer, userid, userid, userSer]
            );
            if (result.length > 0){
                retVal.dateShared = result[0].date_shared.toISOString();
            }
        });
        return retVal;
    }
}
