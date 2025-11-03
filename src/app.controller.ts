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
    return { username: "수서", notificationCnt: 3,
      sideStyle: {
        shared: "display:none",
      }
    };
  }

  @Get('prefs/account')
  @Render('prefs/account')
  getAcc() {
    return { username: "수서", notificationCnt: 3,
      sideStyle: {
        shared: "display:none",
      }
    };
  }

  @Get('prefs')
  @Render('prefs/prefs')
  getPrefs() {
    return { username: "수서", notificationCnt: 3,
      sideStyle: {
        shared: "display:none",
      }
    };
  }

  @Get('files/bookmarks')
  @Render('files/files')
  getBookmarks() {
    return { username: "수서", notificationCnt: 3, 
      dirName: "즐겨찾기",
      dirPath: "<a class=\"addrLink\" href=\"/files/bookmarks\">bookmarks</a>",
      sideStyle: {
        shared: "display:none",
        bookmarksSel: "Sel"
      }
    };
  }
  
  @Get('files')
  @Render('files/files')
  getFiles() {
    return { username: "수서", notificationCnt: 3, 
      dirName: "파일",
      dirPath: "<a class=\"addrLink\" href=\"/files\">files</a>",
      sideStyle: {
        shared: "display:none",
        filesSel: "Sel"
      }
    };
  }

  @Get('home/notifications')
  @Render('home/notifications')
  getNotif() {
    return {
      username: "수서",
      notificationCnt: 3,
      sideStyle: {
        shared: "display:none"
      }
    }
  }
}
