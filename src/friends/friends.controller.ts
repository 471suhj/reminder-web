import { Controller, Delete, Get, Post, Put, Body, Query, ParseIntPipe, Logger } from '@nestjs/common';
import { FriendListDto } from './friend-list.dto';
import { User } from 'src/user/user.decorator';
import { FilesArrDto } from 'src/files/files-arr.dto';
import { SortModeDto } from 'src/files/sort-mode.dto';
import { FileDelResDto } from 'src/files/file-del-res.dto';
import { UserCommonDto } from 'src/user/user-common.dto';
import { DataSource } from 'typeorm';
import { MysqlService } from 'src/mysql/mysql.service';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { FilesService } from 'src/files/files.service';

@Controller('friends')
export class FriendsController {

    constructor(
        private dataSource: DataSource,
        private mysqlService: MysqlService,
        private filesService: FilesService
    ){}

    private readonly logger = new Logger(FriendsController.name);

    @Get()
    async getFriends(@User(ParseIntPipe) userSer: number): Promise<UserCommonDto>{
        return new UserCommonDto();
    }

    @Put()
    async renameFriends(
        @User(ParseIntPipe) userSer: number,
        @Body() body: {id: number, newname: string}
    ): Promise<{success: boolean, failmessage?: string}>{
        let result: ResultSetHeader;
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
        let result: RowDataPacket[];
        await this.filesService.resolveFriendLoadmore(userSer, body.friends, body.last, body.sort);
        await this.mysqlService.doTransaction('friends controller delete', async (conn)=>{
            await conn.execute(
                `delete from shared_def where (user_serial_to=? and user_serial_from in ?) or (user_serial_from=? and user_serial_to in ?)`,
                [userSer, body.friends, userSer, body.friends]
            );
            await conn.execute(
                `delete from friend where (user_serial_to=? and user_serial_from in ?) or (user_serial_from=? and user_serial_to in ?)`,
                [userSer, body.friends, userSer, body.friends]
            );
            await conn.execute(
                `delete from friend_mono where (user_serial_to=? and user_serial_from in ?) or (user_serial_from=? and user_serial_to in ?)`,
                [userSer, body.friends, userSer, body.friends]
            );
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
        await this.mysqlService.doTransaction('friends controller delete', async (conn, rb)=>{
            let [result] = await conn.execute<RowDataPacket[]>(
                `select user_serial from user where user_id=? for share`,
                [body.id]
            );
            if (result.length <= 0){
                retVal.success = false;
                retVal.failmessage = '존재하지 않는 사용자입니다.';
                rb.rback = true;
                return;
            }
            [result] = await conn.execute<RowDataPacket[]>(
                `select user_serial_to from friend_mono where user_serial_to=? and user_serial_from=? for update`,
                [userSer, result[0].user_serial]
            );
            if (result.length > 0){
                retVal.success = false;
                retVal.failmessage = '이미 등록된 사용자입니다.';
                rb.rback = true;
                return;
            }
            [result] = await conn.execute<RowDataPacket[]>(
                `select ... for update`,
                [userSer, result[0].user_serial]
            );
            if (result.length > 0){
                retVal.success = false;
                // 요청은 승낙/거부/보류(메시지 삭제 포함). 거부시 알림, 보류시 요청 내역에서만 삭제, 요청 내역이 있는 경우 3일 이후 재요청 가능, 재요청시 기간 갱신, 20일 후 요청 내역 삭제
                retVal.failmessage = '이미 요청이 전송된 사용자입니다.';
                rb.rback = true;
                return;
            }
        });

        return retVal;
    }

    @Put('consent')
    async consentFriend(@User(ParseIntPipe) userSer: number, @Body() body: {id: string}): Promise<{success: boolean, failmessage?: string}>{
        // only undeleted friends, and those who are not friends yet.
        let retVal: {success: boolean, failmessage?: string} = {success: true};
        await this.mysqlService.doTransaction('friends controller delete', async (conn)=>{
            //
        });

        return retVal;
    }

    @Get('list') // for fileupload
    async getFriendList(@User(ParseIntPipe) userSer: number): Promise<FriendListDto>{
        return new FriendListDto();
    }
}
