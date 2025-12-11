import { Controller, Get, Param, Query, Render, Req, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthDec } from './auth/auth.decorator';
import type { Request, Response } from 'express';
import { MysqlService } from './mysql/mysql.service';
import { RowDataPacket } from 'mysql2';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private mysqlService: MysqlService) {}

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
  getEdit(){
    return {
      fileName: "제목없음",
      filePath: "/files/제목없음",
      userName: "수서",
    };

  }

  @Get('test')
  @Render('test')
  getTest(){
    return {};
  }

  @Get('edit/inter')
  getEditInter(){
    return {
      sharedState: false,
      sharedAccounts: "",
      readOnly: false,
      curUsers: "-",
      itmUsers: ["", "", "", "", "", "", "", ""],
      itmCur: 3,
      txtCur: "To C or not to C, that is the question. 한글 확인.",
      curLoc: [],
    };

  }

}
