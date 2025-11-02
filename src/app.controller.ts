import { Controller, Get, Render } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('index')
  getHello() {
    return {};
  }

  @Get('home')
  @Render('home/home')
  getHome(){
    return { username: "수서", notificationCnt: 3};
  }

  @Get('prefs/account')
  @Render('prefs/account')
  getAcc() {
    return { username: "수서", notificationCnt: 3};
  }

  @Get('prefs')
  @Render('prefs/prefs')
  getPrefs() {
    return { username: "수서", notificationCnt: 3};
  }

  @Get('files/bookmarks')
  @Render('files/bookmarks')
  getBookmarks() {
    return { username: "수서", notificationCnt: 3}
  }
}
