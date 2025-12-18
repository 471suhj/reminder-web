import { BadRequestException, Body, Controller, Delete, Get, InternalServerErrorException, Logger, Param, ParseIntPipe, Query, Render } from '@nestjs/common';
import { MongoService } from 'src/mongo/mongo.service';
import { MysqlService } from 'src/mysql/mysql.service';
import { PrefsService } from 'src/prefs/prefs.service';
import { User } from 'src/user/user.decorator';
import { HomeGetDto } from './home-get.dto';
import { NotifGetDto } from './notif-get.dto';
import { NotifMoreDto } from './notif-more.dto';
import { RowDataPacket } from 'mysql2';
import { Document, FindCursor, ObjectId } from 'mongodb';
import { HomeService } from './home.service';
import { NotifDelDto } from './notif-del.dto';
import { FileDelResDto } from 'src/files/file-del-res.dto';
import { NotifDelResDto } from './notif-del-res.dto';

@Controller('home')
export class HomeController {

    constructor (
        private readonly mysqlService: MysqlService,
        private readonly mongoService: MongoService,
        private readonly prefsService: PrefsService,
        private readonly homeService: HomeService,
    ){}
        
    private readonly logger = new Logger(HomeController.name);

    private getHome_listFile(i: number, itm: any, arrFile: HomeGetDto['homeList'][number]['itemList']){
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
        retVal.homeList = [];
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
                const arrFile: HomeGetDto['homeList'][number]['itemList'] = [];
                for (let i = 0; i < result.length; i++){
                    this.getHome_listFile(i + 1, result[i], arrFile);
                }
                retVal.homeList.push({title: '즐겨 찾기', link: '/files/bookmarks', itemList: arrFile});
            }
            if (sections.home_files === 'true'){
                if (sections.save_recent === 'true'){
                    [result] = await conn.execute<RowDataPacket[]>(
                        `select file_serial, file_name, type, issys from file where user_serial=? and issys='false' order by last_opened desc limit 7`,
                        [userSer]
                    );
                    const arrFile: HomeGetDto['homeList'][number]['itemList'] = [];
                    for (let i = 0; i < result.length; i++){
                        this.getHome_listFile(i + 1, result[i], arrFile);
                    }
                    retVal.homeList.push({title: '최근 파일', link: '/files', itemList: arrFile});
                }
            }
            if (sections.home_shared === 'true'){
                let crit = sections.save_recent === 'true' ? 'last_opened desc' : 'file_name asc';
                [result] = await conn.execute<RowDataPacket[]>(
                    `select file_serial, file_name from shared_def where user_serial_to=? order by ${crit} limit 7`,
                    [userSer]
                );
                    const arrFile: HomeGetDto['homeList'][number]['itemList'] = [];
                    for (let i = 0; i < result.length; i++){
                        this.getHome_listFile(i + 1, result[i], arrFile);
                    }
                retVal.homeList.push({title: '공유된 파일', link: '/files/shared', itemList: arrFile});
            }
        });
        if (sections.home_notifs === 'true'){
            let cur: FindCursor;
            try{
                let dbNof = this.mongoService.getDb().collection('notification');
                let query = {to: userSer, read: false};
                let sort: {[k: string]: 1|-1} = {_id: -1};
                let fields = {data: 1, type: 1};
                cur = dbNof.find(query).sort(sort).limit(7).project(fields);
                let arrList: HomeGetDto['homeList'][number]['itemList'] = [];
                let i = 0;
                for await (const itm of cur){
                    i++;
                    const prevText = await this.homeService.getNotifText(userSer, itm.type, itm.data, '', true);
                    arrList.push([i % 2 ? 'A' : 'B', i, prevText, 'notif', '/home/notifications/' + itm._id.toString('hex')]);
                }
                await cur.close();
                retVal.homeList.push({title: '알림', link: '/home/notifications', itemList: arrList});
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
        retVal.notificationCnt = 0;
        return retVal; 
    }

    @Delete('notifications/update')
    async deleteNotifs(@User() userSer: number, @Body() body: NotifDelDto): Promise<NotifDelResDto>{
        let retVal = new NotifDelResDto();
        retVal.failed = [];
        retVal.delarr = [];
        if (body.action === 'all'){
            if (body.first === undefined){throw new BadRequestException();}
            await this.mongoService.getDb().collection('notification')
            .deleteMany({to: userSer, _id: {$lte: new ObjectId(body.first)}});
        } else if (body.action === 'selected'){
            if (body.files === undefined){throw new BadRequestException();}
            await this.mongoService.getDb().collection('notification')
            .deleteMany({to: userSer, _id: {$in: body.files.map(val=>new ObjectId(val))}});
            retVal.delarr = body.files;
        } else {throw new BadRequestException();}
        return retVal;
    }

    @Get("notifications/loadmore")
    async getNotifMore(@User() userSer: number, @Query('last') last: string): Promise<NotifMoreDto> {
        let retVal = new NotifMoreDto();
        let result: Document[] = [];
        let dbNof = this.mongoService.getDb().collection('notification');
        // get count
        if (last === undefined){throw new BadRequestException();}
        let query: any = {to: userSer};
        if (last !== '0'){
            query._id = {$lt: new ObjectId(last)};
            retVal.unreadCnt = 0;
        } else {
            retVal.unreadCnt = await dbNof.countDocuments({to: userSer, read: false});
        }
        // do the query
        let sort: {[k: string]: 1|-1} = {_id: -1};
        let fields = {urlArr: 1, read: 1, type: 1, data: 1};
        let cur = dbNof.find(query).sort(sort).limit(21).project(fields);
        result = await cur.toArray();
        await cur.close();
        // mark as read
        if (result.length > 0){
            query._id = {$lte: result[0]._id}; // as a way to achieve repeatable read
            query.read = false;
            let update = {$set: {read: true}};
            await dbNof.updateMany(query, update);
        }
        // deal with the results
        retVal.loadMore = (result.length > 20) ? 'true' : 'false';
        if (result.length > 20){
            result.pop();
        }
        let arrLst: NotifMoreDto['arr'] = [];
        for (const itm of result){
            arrLst.push({
                id: itm._id.toString(),
                unread: itm.read ? 'false' : 'true',
                text: await this.homeService.getNotifText(userSer, itm.type, itm.data, '', true),
                linkText: this.homeService.getNotifLinkText(itm.urlArr),
                date: itm._id.getTimestamp().toISOString(),
                link: '/home/notifications/' + itm._id.toString('hex'),
            });
        }
        retVal.arr = arrLst;

        return retVal;
    }

    @Get('notifications/:id')
    async getNotifDetails(@User() userSer: number, @Param('id') id: string): Promise<string>{
        const coll = this.mongoService.getDb().collection('notification');
        const filt = {to: userSer, _id: new ObjectId(id)};
        let res = await coll.findOne(filt, {projection: {type: 1, data: 1}});
        if (res === null){
            return '해당 알림의 정보를 찾을 수 없었습니다.';
        }
        coll.updateOne(filt, {$set: {read: true}});
        return await this.homeService.getNotifText(userSer, res.type, res.data, res._id.getTimestamp().toLocaleString());

    }

}
