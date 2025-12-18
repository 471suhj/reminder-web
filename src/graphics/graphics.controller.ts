import { BadRequestException, Controller, Get, InternalServerErrorException, ParseIntPipe, Query, StreamableFile } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { createReadStream, ReadStream, access } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { MysqlService } from 'src/mysql/mysql.service';
import { User } from 'src/user/user.decorator';

@Controller('graphics')
export class GraphicsController {

    constructor (private readonly mysqlService: MysqlService){}

    @Get('profimg')
    async getProfImg(@User() userSer: number, @Query('id', new ParseIntPipe({optional: true})) id?: number, @Query('cus') cus?: string){
        
        if (id === userSer){
            id = undefined;
        }
        if (id) {
            await this.mysqlService.doQuery('graphics controller getprofimg', async conn=>{
                let [result] = await conn.execute<RowDataPacket[]>(
                    `select user_serial_from from friend_mono where user_serial_to=? and user_serial_from=?`,
                    [userSer, id]
                );
                if (result.length <= 0){
                    throw new BadRequestException();
                }
            });
        } else {
            id = userSer;
        }
        let useCus = false;
        if (cus === 'true'){
            useCus = true;
        } else {
            await this.mysqlService.doQuery('graphics controller getprofimg', async conn=>{
                let [result] = await conn.execute<RowDataPacket[]>(
                    `select use_image from user where user_serial=?`, [id]
                );
                if (result.length <= 0){
                    throw new InternalServerErrorException();
                }
                useCus =  (result[0].use_image === 'true')
            });
        }
        let ret: ReadStream;
        if (useCus){
            try{
                const pth = join(__dirname, `../../userfiles/profimg/${id}.png`);
                const accessFile = promisify(access);
                await accessFile(pth);
                ret = createReadStream(pth);
                return new StreamableFile(ret);
            } catch {
                if (cus === 'true'){
                    return; // return none;
                } // else, get the standard img
            }
        }
        ret = createReadStream(join(__dirname, `../../public/graphics/profile/${(id % 5) + 1}.png`));
        return new StreamableFile(ret);
    }
}