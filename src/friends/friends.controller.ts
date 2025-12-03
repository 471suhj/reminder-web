import { Controller, Delete, Get, Post, Put, Body, Query, ParseIntPipe } from '@nestjs/common';
import { FriendListDto } from './friend-list.dto';
import { User } from 'src/user/user.decorator';
import { FilesArrDto } from 'src/files/files-arr.dto';
import { SortModeDto } from 'src/files/sort-mode.dto';
import { FileDelResDto } from 'src/files/file-del-res.dto';
import { UserCommonDto } from 'src/user/user-common.dto';

@Controller('friends')
export class FriendsController {

    @Get()
    async getFriends(@User(ParseIntPipe) userSer: number): Promise<UserCommonDto>{
        return new UserCommonDto();
    }

    @Put()
    async renameFriends(
        @User(ParseIntPipe) userSer: number,
        @Body() body: {id: number, newname: string}): Promise<{success: boolean, failmessage?: string}>{
        return {success: true};
    }

    @Delete()
    async deleteFriends(
        @User(ParseIntPipe) userSer: number,
        @Body() body: {sort: SortModeDto, files: Array<number>}): Promise<FileDelResDto>{
        return new FileDelResDto();
    }

    @Put('add') // caution: id here means user_id
    async addFriends(@User(ParseIntPipe) userSer: number, @Body() body: {id: string}): Promise<FilesArrDto>{
        return new FilesArrDto();
    }

    @Get('list') // for fileupload
    async getFriendList(@User(ParseIntPipe) userSer: number): Promise<FriendListDto>{
        return new FriendListDto();
    }
}
