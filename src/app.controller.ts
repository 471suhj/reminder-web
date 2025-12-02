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


  @Get('prefs/account')
  @Render('prefs/account')
  getAcc() {
    return { username: "수서", notificationCnt: 3,
      sideItem: [
        ["/home", "", "/graphics/home.png", "홈"],
        ["/files", "", "/graphics/files.png", "파일"],
        ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/graphics/shared.png", "공유"],
        ["/friends", "", "/graphics/friends.png", "친구"],
        ["/prefs", "Sel", "/graphics/prefs.png", "설정"]
      ],
    };
  }

  @Get('prefs')
  @Render('prefs/prefs')
  getPrefs() {
    return { username: "수서", notificationCnt: 3,
      sideItem: [
        ["/home", "", "/graphics/home.png", "홈"],
        ["/files", "", "/graphics/files.png", "파일"],
        ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/graphics/shared.png", "공유"],
        ["/friends", "", "/graphics/friends.png", "친구"],
        ["/prefs", "Sel", "/graphics/prefs.png", "설정"]
      ],
    };
  }

  @Get('friends')
  @Render('friends/friends')
  getFriends() {
    return { username: "수서", notificationCnt: 3, 
      dirName: "친구",
      sideItem: [
        ["/home", "", "/graphics/home.png", "홈"],
        ["/files", "", "/graphics/files.png", "파일"],
        ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/graphics/shared.png", "공유"],
        ["/friends", "Sel", "/graphics/friends.png", "친구"],
        ["/prefs", "", "/graphics/prefs.png", "설정"]
      ],
      countItem: "false",
    };
  }
  @Get('friends/profile')
  @Render('friends/profile')
  getFriendProf() {
    return { username: "수서", notificationCnt: 3, 
      friendNickname: "개포동",
      friendName: "개포동",
      friendID: "개포동2",
      sideItem: [
        ["/home", "", "/graphics/home.png", "홈"],
        ["/files", "", "/graphics/files.png", "파일"],
        ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/graphics/shared.png", "공유"],
        ["/friends", "Sel", "/graphics/friends.png", "친구"],
        ["/prefs", "", "/graphics/prefs.png", "설정"]
      ],
      countItem: "false",
    };
  }

  @Get("/friends/loadmore")
  getFriendsMore(@Query("startafter") startAfter: string){
    let loadmore = (startAfter === "loadmore") ? "true" : "false"
    let arrid = (startAfter === "loadmore") ? ["c1", "c2", "c3"] : ["c4", "c5", "c6"];
    return JSON.stringify({
      loadMore: loadmore,
      arr: [
        {id: arrid[0], bookmarked: "true", text: "고양이", date: "20230228", link: "/friends/profile"},
        {id: arrid[1], bookmarked: "false", text: "사슴", date: "20220228"},
        {id: arrid[2], bookmarked: "false", text: "수리부엉이", date: "20220128", isFolder: "false"}
      ]
    }
    )
  }



}
