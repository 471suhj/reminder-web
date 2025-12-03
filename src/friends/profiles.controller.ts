import { Controller, Delete, Get, Post, Put, Body, Query, ParseIntPipe } from '@nestjs/common';
import { User } from 'src/user/user.decorator';
import { ProfileGetDto } from './profile-get.dto';
import { FileDelResDto } from 'src/files/file-del-res.dto';
import { SharedDelDto } from './shared-del.dto';

@Controller('friends/profile')
export class ProfilesController {

    @Get()
    async getProfile(@User(ParseIntPipe) userSer: number, @Query('id', ParseIntPipe) userid: number): Promise<ProfileGetDto>{
        return new ProfileGetDto();
    }

    @Delete()
    async deleteFriendProfile(@User(ParseIntPipe) userSer: number, @Body() body: SharedDelDto): Promise<FileDelResDto>{
        return new FileDelResDto();
    }
}
