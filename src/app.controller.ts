import { Controller, Get, Query, Render } from '@nestjs/common';
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
        ["/home", "Sel", "/graphics/home.png", "홈"],
        ["/files", "", "/graphics/files.png", "파일"],
        ["/files/bookmarks", "", "/bgraphics/ookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/graphics/shared.png", "공유"],
        ["/friends", "", "/graphics/friends.png", "친구"],
        ["/prefs", "", "/graphics/prefs.png", "설정"]
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
        ["/home", "", "/graphics/home.png", "홈"],
        ["/files", "Sel", "/graphics/files.png", "파일"],
        ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/graphics/shared.png", "공유"],
        ["/friends", "", "/graphics/friends.png", "친구"],
        ["/prefs", "", "/graphics/prefs.png", "설정"]
      ],
      countItem: "false",
    };
  }

  @Get("/files/loadmore")
  getFileMore(@Query("startafter") startAfter: string){
    let loadmore = (startAfter === "loadmore") ? "true" : "false"
    let arrid = (startAfter === "loadmore") ? ["c1", "c2", "c3"] : ["c4", "c5", "c6"];
    return JSON.stringify({
      loadMore: loadmore,
      arr: [
        {id: arrid[0], bookmarked: "true", text: "고양이", date: "20230228"},
        {id: arrid[1], bookmarked: "false", text: "사슴", date: "20220228"},
        {id: arrid[2], bookmarked: "false", text: "수리부엉이", date: "20220128", isFolder: "false"}
      ]
    }
    )
  }

  @Get('friends')
  @Render('friends/friends')
  getFriends() {
    return { username: "수서", notificationCnt: 3, 
      dirName: "파일",
      dirPath: "<a class=\"addrLink\" href=\"/files\">files</a>",
      sideItem: [
        ["/home", "", "/graphics/home.png", "홈"],
        ["/files", "Sel", "/graphics/files.png", "파일"],
        ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/graphics/shared.png", "공유"],
        ["/friends", "", "/graphics/friends.png", "친구"],
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
        {id: arrid[0], bookmarked: "true", text: "고양이", date: "20230228"},
        {id: arrid[1], bookmarked: "false", text: "사슴", date: "20220228"},
        {id: arrid[2], bookmarked: "false", text: "수리부엉이", date: "20220128", isFolder: "false"}
      ]
    }
    )
  }



  @Get('home/notifications')
  @Render('home/notifications')
  getNotif() {
    return {
      username: "수서",
      notificationCnt: 3,
      sideItem: [
        ["/home", "", "/graphics/home.png", "홈"],
        ["/files", "", "/graphics/files.png", "파일"],
        ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
        ["/files/shared", "", "/graphics/shared.png", "공유"],
        ["/friends", "", "/graphics/friends.png", "친구"],
        ["/prefs", "", "/graphics/prefs.png", "설정"]
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
    return JSON.stringify({
      loadMore: "false",
      arr: [
        {id: "list7", unread: "true", text: "고양이", date: "20230228"},
        {id: "list8", unread: "false", text: "사슴", date: "20220228"},
        {id: "list9", unread: "false", text: "수리부엉이", date: "20220128"}
      ]
    }
    )
  }
}
