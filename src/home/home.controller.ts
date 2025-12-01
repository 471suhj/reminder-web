import { Controller, Get, Query, Render } from '@nestjs/common';

@Controller('home')
export class HomeController {

    @Get()
    @Render('home/home')
    getHome(@Query() query){
        return { username: "수서", notificationCnt: 3,
        sideItem: [
            ["/home", "Sel", "/graphics/home.png", "홈"],
            ["/files", "", "/graphics/files.png", "파일"],
            ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
            ["/files/shared", "", "/graphics/shared.png", "공유"],
            ["/friends", "", "/graphics/friends.png", "친구"],
            ["/prefs", "", "/graphics/prefs.png", "설정"]
        ],
        homeList: [
            {
            link: "/files/bookmarks",
            title: "즐겨찾기",
            Item: [
                ["A", 1, "제목없음", "false", "/edit"], ["B", 2, "고양이", "false", "/files"], ["A", 3, "강아지", "false", "/files"], ["B", 4, "고양이", "false", "/files"] 
            ]
            },
            {
            link: "/home/notifications",
            title: "알림",
            Item: [
                ["A", 1, "강아지", "true"], ["B", 2, "고양이", "true"], ["A", 3, "강아지", "true"], ["B", 4, "고양이", "true"], ["A", 5, "강아지", "true"], ["B", 6, "고양이", "true"],["A", 7, "고양이", "true"] 
            ]
            },
            {
            link: "/files",
            title: "최근 파일",
            Item: [
                ["A", 1, "강아지", "false"], ["B", 2, "고양이", "false"], ["A", 3, "강아지", "false"], ["B", 4, "고양이", "false"], ["A", 5, "강아지", "false"], ["B", 6, "고양이", "false"],["A", 7, "고양이", "false"] 
            ]
            },
            {
            link: "/files/shared",
            title: "공유",
            Item: [
                ["A", 1, "강아지", "true"], ["B", 2, "고양이", "true"], ["A", 3, "강아지", "true"], ["B", 4, "고양이", "true"], ["A", 5, "강아지", "true"], ["B", 6, "고양이", "true"],["A", 7, "고양이", "true"] 
            ]
            },
        ]
        };
    }


    @Get('notifications')
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

    @Get("notifications/loadMore")
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
