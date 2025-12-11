import { Controller, Delete, Get, InternalServerErrorException, Logger, Param, ParseIntPipe, Query, Render } from '@nestjs/common';
import { MongoService } from 'src/mongo/mongo.service';
import { MysqlService } from 'src/mysql/mysql.service';
import { PrefsService } from 'src/prefs/prefs.service';
import { User } from 'src/user/user.decorator';
import { HomeGetDto } from './home-get.dto';
import { NotifGetDto } from './notif-get.dto';
import { NotifMoreDto } from './notif-more.dto';
import { RowDataPacket } from 'mysql2';
import { Document, FindCursor } from 'mongodb';

@Controller('home')
export class HomeController {

    constructor (
        private readonly mysqlService: MysqlService,
        private readonly mongoService: MongoService,
        private readonly prefsService: PrefsService,
    ){}
        
    private readonly logger = new Logger(HomeController.name);

    private getHome_listFile(i, itm: any, arrFile: HomeGetDto['homelist'][number]['itemList']){
        let isFile = itm.type === 'file' || itm.type === undefined;
        let link = '';
        if (itm.issys === 'true'){ // false if undefined (for shared_defs)
            if (itm.file_name === 'files'){
                link = '/files';
            } else {
                link = '/files/' + itm.file_name;
            }
        } else {
            link = (isFile ? '/edit?id=' : '/files?id=') + itm.file_serial;
        }
        arrFile.push([i % 2 ? 'A' : 'B', i, itm.file_name, 
            isFile ? 'newwin' : 'false', link]);
    }

    @Get()
    @Render('home/home')
    async getHome(@User() userSer: number): Promise<HomeGetDto>{
        let retVal = new HomeGetDto();
        retVal.homelist = [];
        let sections: {[k: string]: 'true'|'false'} = {};
        await this.mysqlService.doQuery('home controller get home', async conn=>{
            let [result] = await conn.execute<RowDataPacket[]>(
                `select home_bookmarks, home_notifs, home_files, home_shared, save_recent from user where user_serial=?`,
                [userSer]
            );
            if (result.length <= 0){throw new InternalServerErrorException();}
            sections = result[0];
            if (sections.home_bookmarks === 'true'){
                let crit = sections.save_recent === 'true' ? 'last_opened desc' : 'file_name asc';
                [result] = await conn.execute<RowDataPacket[]>(
                    `select file_serial, file_name, type, issys from bookmark where reader=? order by ${crit} limit 7`,
                    [userSer]
                );
                const arrFile: HomeGetDto['homelist'][number]['itemList'] = [];
                for (let i = 0; i < result.length; i++){
                    this.getHome_listFile(i, result[i], arrFile);
                }
                retVal.homelist.push({title: '바로 가기', link: '/files/bookmarks', itemList: arrFile});
            }
            if (sections.home_files === 'true'){
                if (sections.save_recent === 'true'){
                    [result] = await conn.execute<RowDataPacket[]>(
                        `select file_serial, file_name, type, issys from file where user_serial=? order by last_opened desc limit 7`,
                        [userSer]
                    );
                    const arrFile: HomeGetDto['homelist'][number]['itemList'] = [];
                    for (let i = 0; i < result.length; i++){
                        this.getHome_listFile(i, result[i], arrFile);
                    }
                    retVal.homelist.push({title: '최근 파일', link: '/files', itemList: arrFile});
                }
            }
            if (sections.home_shared === 'true'){
                let crit = sections.save_recent === 'true' ? 'last_opened desc' : 'file_name asc';
                [result] = await conn.execute<RowDataPacket[]>(
                    `select file_serial, file_name from file where user_serial_to=? order by ${crit} limit 7`,
                    [userSer]
                );
                    const arrFile: HomeGetDto['homelist'][number]['itemList'] = [];
                    for (let i = 0; i < result.length; i++){
                        this.getHome_listFile(i, result[i], arrFile);
                    }
                retVal.homelist.push({title: '공유', link: '/files/shared', itemList: arrFile});
            }
        });
        if (sections.home_notifs === 'true'){
            let cur: FindCursor;
            try{
                let dbNof = this.mongoService.getDb().collection('notification');
                let query = {to: userSer};
                let sort: {[k: string]: 1|-1} = {time: -1};
                let fields = {id: 1, prevText: 1};
                cur = dbNof.find(query).sort(sort).limit(7).project(fields);
                let arrList: HomeGetDto['homelist'][number]['itemList'] = [];
                let i = 0;
                for await (const itm of cur){
                    arrList.push([i % 2 ? 'A' : 'B', i, itm.prevText, 'notif', '/home/notifications/' + itm.id]);
                }
                await cur.close();
            } catch (err) {
                this.logger.log(err);
                try{await cur!.close();}catch{}
            }
        }

        retVal = {...retVal, ...(await this.prefsService.getUserCommon(userSer, 'home'))};
        return retVal;
    }


    @Get('notifications')
    @Render('home/notifications')
    async getNotif(@User() userSer: number): Promise<NotifGetDto> {
        let retVal = new NotifGetDto();
        let dbNof = this.mongoService.getDb().collection('notification');
        retVal.itemCnt = await dbNof.countDocuments({to: userSer});
        retVal = {...retVal, ...(await this.prefsService.getUserCommon(userSer, 'home'))};
        retVal.countItem = 'true';
        return retVal; 
    }

    @Delete('update')
    async deleteNotifs(@User() userSer: number){
    }

    @Get('notifications/:id')
    async getNotifDetails(@User() userSer: number, @Param('id', ParseIntPipe) id: number){
        //
    }

    @Get("notifications/loadMore")
    async getNotifMore(@User() userSer: number, ): Promise<NotifMoreDto> {
        let retVal = new NotifMoreDto();
        let result: Document[] = [];
        let dbNof = this.mongoService.getDb().collection('notification');
        let query: any = {to: userSer};
        let sort: {[k: string]: 1|-1} = {time: -1};
        let fields = {id: 1, prevText: 1, urlArr: 1, read: 1};
        let cur = dbNof.find(query).sort(sort).limit(21).project(fields);
        result = await cur.toArray();
        await cur.close();
        query.time = {$lte: result[0].time}; // as a way to achieve repeatable read
        query.read = false;
        let update = {$set: {read: true}}
        await dbNof.updateMany(query, update);
        retVal.loadMore = (result.length > 20) ? 'true' : 'false';
        let arrLst: NotifMoreDto['arr'] = [];
        for (const itm of result){
            arrLst.push({
                id: 'item' + itm._id,
                unread: itm.read ? 'false' : 'true',
                text: itm.prevText, // add urlArr later
                date: itm.time.toISOString()
            });
        }
        retVal.arr = arrLst;

        return retVal;
    }

}
