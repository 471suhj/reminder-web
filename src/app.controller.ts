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
      sideItem: [
        ["/home", "Sel", "/home.png", "홈"],
        ["/files", "", "/files.png", "파일"],
        ["/files/bookmarks", "", "/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/shared.png", "공유"],
        ["/friends", "", "/friends.png", "친구"],
        ["/prefs", "", "/prefs.png", "설정"]
      ],
      homeList: [
        {
          link: "/files/bookmarks",
          title: "즐겨찾기",
          Item: [
            ["A", 1, "강아지", "/files"], ["B", 2, "고양이", "/files"], ["A", 3, "강아지", "/files"], ["B", 4, "고양이", "/files"] 
          ]
        },
        {
          link: "/home/notifications",
          title: "알림",
          Item: [
            ["A", 1, "강아지"], ["B", 2, "고양이"], ["A", 3, "강아지"], ["B", 4, "고양이"], ["A", 5, "강아지"], ["B", 6, "고양이"],["A", 7, "고양이"] 
          ]
        },
        {
          link: "/files",
          title: "최근 파일",
          Item: [
            ["A", 1, "강아지"], ["B", 2, "고양이"], ["A", 3, "강아지"], ["B", 4, "고양이"], ["A", 5, "강아지"], ["B", 6, "고양이"],["A", 7, "고양이"] 
          ]
        },
        {
          link: "/files/shared",
          title: "공유",
          Item: [
            ["A", 1, "강아지"], ["B", 2, "고양이"], ["A", 3, "강아지"], ["B", 4, "고양이"], ["A", 5, "강아지"], ["B", 6, "고양이"],["A", 7, "고양이"] 
          ]
        },
      ]
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
      sideItem: [
        ["/home", "", "/home.png", "홈"],
        ["/files", "Sel", "/files.png", "파일"],
        ["/files/bookmarks", "", "/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/shared.png", "공유"],
        ["/friends", "", "/friends.png", "친구"],
        ["/prefs", "", "/prefs.png", "설정"]
      ],
      countItem: "true",
      itemList: [
        {id: "list1", unread: "true", text: "고양이", date: "20230228"},
        {id: "list2", unread: "true", text: "사슴", date: "20220228"},
        {id: "list3", unread: "true", text: "수리부엉이", date: "20220128"},
        {id: "list4", unread: "false", text: "고양이", date: "20230228"},
        {id: "list5", unread: "false", text: "사슴", date: "20220228"},
        {id: "list6", unread: "false", text: "수리부엉이", date: "20220128"}        
      ],
      showLoadMore: "true",
    };
  }

  @Get('home/notifications')
  @Render('home/notifications')
  getNotif() {
    return {
      username: "수서",
      notificationCnt: 3,
      sideItem: [
        ["/home", "", "/home.png", "홈"],
        ["/files", "", "/files.png", "파일"],
        ["/files/bookmarks", "", "/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/shared.png", "공유"],
        ["/friends", "", "/friends.png", "친구"],
        ["/prefs", "", "/prefs.png", "설정"]
      ],
      itemCnt: 6,
      itemList: [
        {id: "list1", unread: "true", text: "고양이<br>고양이", date: "20230228"},
        {id: "list2", unread: "true", text: "사슴", date: "20220228"},
        {id: "list3", unread: "true", text: "수리부엉이", date: "20220128"},
        {id: "list4", unread: "false", text: "고양이", date: "20230228"},
        {id: "list5", unread: "false", text: "사슴", date: "20220228"},
        {id: "list6", unread: "false", text: "수리부엉이", date: "20220128"}        
      ],
      showLoadMore: "true",
    }
  }

  @Get("/home/notifications/loadMore")
  getNotifMore(){
    return JSON.stringify(
      [
        {id: "list7", unread: "true", text: "고양이", date: "20230228", loadMore: "false"},
        {id: "list8", unread: "false", text: "사슴", date: "20220228"},
        {id: "list9", unread: "false", text: "수리부엉이", date: "20220128"}
      ]
    )
  }
}
