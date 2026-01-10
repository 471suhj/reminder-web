import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Query, Render, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthDec } from './auth/auth.decorator';
import type { Request, Response } from 'express';
import { MysqlService } from './mysql/mysql.service';
import { RowDataPacket } from 'mysql2';
import { User } from './user/user.decorator';
import { FilesService } from './files/files.service';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MongoService } from './mongo/mongo.service';
import { WithId } from 'mongodb';
import { FileUtilsService } from './files/file-utils.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService,
    private readonly mysqlService: MysqlService,
    private readonly mongoService: MongoService,
    private readonly fileUtilsService: FileUtilsService,
  ) {}

  @AuthDec('anony-only')
  @Get()
  @Render('index')
  async getHello(@Req() request: Request, @Res({ passthrough: true }) response: Response, @Query() query) {
    // await this.mysqlService.doQuery('', async (conn)=>{
    //   let [result] = await conn.execute<RowDataPacket[]>('select last_updated from old_id where last_updated=?', ['2025-12-02T02:50:38.000Z']);
    //   console.log(typeof (result[0].last_updated));
    //   console.log(result[0].last_updated instanceof Date)
    //   console.log(result[0].last_updated)
    // })
    return {};
  }

  @Get('edit')
  @Render('edit')
  async getEdit(@User() userSer: number, @Query('id', ParseIntPipe) fileid: number){
    const pool = await this.mysqlService.getSQL();
    const [name] = await pool.execute<RowDataPacket[]>(
      `select name from user where user_serial=?`, [userSer]
    );
    let [eligible] = await pool.execute<RowDataPacket[]>(
      `select file_name, 'owner' as share_type from file where file_serial=? and user_serial=?`,
      [fileid, userSer]
    );
    if (eligible.length <= 0){
      [eligible] = await pool.execute<RowDataPacket[]>(
        `select file_name, share_type from shared_def where file_serial=? and user_serial_to=?`,
        [fileid, userSer]
      );
    }
    if (eligible.length <= 0){
      throw new ForbiddenException();
    }

    let path = '공유된 파일';
    if (eligible[0].share_type === 'owner'){
      ({path} = await this.fileUtilsService.getDirInfo(pool, userSer, fileid));
    }

    let def;
    return def = {
      fileName: eligible[0].file_name,
      filePath: path,
      fileId: fileid,
      userName: name[0].name,
    };

  }

  @Get('edit/inter')
  async getEditInter(@User() userSer: number,
  @Query('id', ParseIntPipe) fileid: number,
  @Query('loc', new ParseIntPipe({optional: true})) loc?: number
){
    const pool = await this.mysqlService.getSQL();
    let [eligible] = await pool.execute<RowDataPacket[]>(
      `select file_name, 'owner' as share_type from file where file_serial=? and user_serial=?`,
      [fileid, userSer]
    );
    if (eligible.length <= 0){
      [eligible] = await pool.execute<RowDataPacket[]>(
        `select file_name, share_type from shared_def where file_serial=? and user_serial_to=?`,
        [fileid, userSer]
      );
    }
    if (eligible.length <= 0){
      throw new ForbiddenException();
    }

    let meta;
    if (loc === undefined){
      meta = await this.mongoService.getDb().collection('file_data').findOne({serial: fileid});
    }
    loc = loc ?? 1;
    const content = await readFile(join(__dirname, `../filesys/${fileid}/${loc}`), {encoding: 'utf8'});
    return {
      curUsers: "-",
      itmCur: loc,
      txtCur: content,
      curLoc: [],
      itmUsers: Array(meta ? meta.arrlen : 15).fill(''),
    };
  }

  @AuthDec('all')
  @Get('unsubscribe')
  async getUnsubscribe(@Query('addr') addr?: string): Promise<string>{
    if (addr === undefined) {
      return '주소가 제공되지 않았습니다.';
    } else if (addr.length > 320 || !addr.includes('@')) {
      return '잘못된 주소입니다.';
    }
    let errOccurred = false;
    this.mysqlService.doTransaction('unsubscribe', async conn=>{
      try{
        const [result] = await conn.execute<RowDataPacket[]>(`select email from email_blocked where email=? and email2=? for update`, [addr.slice(0, 65), addr.slice(65)]);
        if (result.length <= 0) {
          await conn.execute<RowDataPacket[]>(`insert into email_blocked (email, email2) value (?, ?)`, [addr.slice(0, 65), addr.slice(65)]);
        }
      } catch (err) {
        errOccurred = true;
        console.log(err);
      }
    });
    if (errOccurred) {
      return '수신 거부의 과정에서 오류가 발생했습니다. comtrams@outlook.com으로 문의 부탁드립니다. 불편을 드려서 죄송합니다.';
    }
    return addr + '(으)로의 수신 거부가 완료되었습니다.';
  }

  @AuthDec('all')
  @Get('private-cv')
  @Render('test')
  getTest(){
    return {};
  }

}
