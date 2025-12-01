import { Controller, Get, Render, Query, Param } from '@nestjs/common';
import { MysqlService } from 'src/mysql/mysql.service';
import { User } from 'src/user/user.decorator';
import { FilesGetDto } from './files-get.dto';
import { PrefsService } from 'src/prefs/prefs.service';
import { Pool, RowDataPacket } from 'mysql2/promise';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
    constructor(private mysqlService: MysqlService, private prefsService: PrefsService, private filesService: FilesService){}

    @Get()
    @Render('files/files')
    async getFiles(@User() userSer: number, @Query('dirid') dirid: number|undefined): Promise<FilesGetDto> {
        let retObj: FilesGetDto = new FilesGetDto();
        if (dirid === undefined){
            dirid = await this.filesService.getUserRoot(userSer);
        }
        
        retObj.countItem = 'false';
        retObj.path = path;
        const pathArr = path.split('/');
        if (path !== 'files'){
            retObj.uplink = '/files?path=' + path.slice(0, pathArr.slice(-1)[0].length * (-1) - 1);
        } else {
            retObj.uplink = '/files?path=files';
        }
        retObj.dirName = pathArr.slice(-1)[0];
        // need auth!!
        retObj.dirId = ;
        retObj.dirPath = '<a class="addrLink" href="/files">files</a>';
        let link = 'files';
        for (let i = 1; i < pathArr.length; i++){
            link += '/' + pathArr[i];
            retObj.dirPath += '<a class="addrLink" href="/files?path=' + link + '">/' + pathArr[i] + '</a>'
        }

        retObj = {...retObj, ...(await this.prefsService.getUserCommon(userSer, 'files'))};
        return retObj;
    }

    @Get('loadmore')
    async getFileMore(
        @User() userSer: number,
        @Query('startafter') startAfter: string, 
        @Query('dirid') dirId: number, 
        @Query('sort') sort: string,
        @Query('sortincr') sortincr: 'true'|'false'){

        const pool: Pool = await this.mysqlService.getSQL();
        await pool.execute<RowDataPacket[]>('select * from file where user_serial=? and parent_serial=?')

        let loadmore = (startAfter === "loadmore") ? "true" : "false"
        let arrid = (startAfter === "loadmore") ? ["c1", "c2", "c3"] : ["c4", "c5", "c6"];
        return JSON.stringify({
        loadMore: loadmore,
        arr: [
            {id: arrid[0], bookmarked: "true", text: "고양이", date: "20230228"},
            {id: arrid[1], bookmarked: "false", text: "사슴", date: "20220228"},
            {id: arrid[2], bookmarked: "false", text: "수리부엉이", date: "20220128", isFolder: "false"}
        ]
        });
    }
    
    @Get('bookmarks')
    @Render('files/shared')
    getBookmarks() {
        return { username: "수서", notificationCnt: 3, 
        dirName: "즐겨찾기",
        dirPath: "<a class=\"addrLink\" href=\"/files\">files</a><a class=\"addrLink\" href=\"/files/bookmarks\">/bookmarks</a>",
        sideItem: [
            ["/home", "", "/graphics/home.png", "홈"],
            ["/files", "", "/graphics/files.png", "파일"],
            ["/files/bookmarks", "Sel", "/graphics/bookmarks.png", "즐겨찾기"],
            ["/files/shared", "", "/graphics/shared.png", "공유"],
            ["/friends", "", "/graphics/friends.png", "친구"],
            ["/prefs", "", "/graphics/prefs.png", "설정"]
        ],
        countItem: "false",
        };
    }

    @Get('shared')
    @Render('files/shared')
    getShared() {
        return { username: "수서", notificationCnt: 3, 
        dirName: "공유",
        dirPath: "<a class=\"addrLink\" href=\"/files\">files</a><a class=\"addrLink\" href=\"/files/shared\">/shared</a>",
        sideItem: [
            ["/home", "", "/graphics/home.png", "홈"],
            ["/files", "", "/graphics/files.png", "파일"],
            ["/files/bookmarks", "", "/graphics/bookmarks.png", "즐겨찾기"],
            ["/files/shared", "Sel", "/graphics/shared.png", "공유"],
            ["/friends", "", "/graphics/friends.png", "친구"],
            ["/prefs", "", "/graphics/prefs.png", "설정"]
        ],
        countItem: "false",
        };
    }

    @Get("shared/loadmore")
    getSharedMore(@Query("startafter") startAfter: string){
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



}
