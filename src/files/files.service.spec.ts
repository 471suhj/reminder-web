import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { FileUtilsService } from './file-utils.service';
import { FileResolutionService } from './file-resolution.service';
import { MysqlService } from 'src/mysql/mysql.service';
import { MongoService } from 'src/mongo/mongo.service';
import { RowDataPacket } from 'mysql2';
import { SysdirType } from './sysdir.type';
import dotenv from 'dotenv';


describe('FilesService', () => {
    dotenv.config({path: 'pfx_pass.env'});

    let service: FilesService;
    let mysqlService: MysqlService;
    let mongoService: MongoService;

    const mockMysqlService = new MysqlService(true);
    const mockMongoService = new MongoService(true);


    const mockFileUtilsService = {

    };

    const mockFileResolutionService = {

    };

    beforeEach(async () => {

        const module: TestingModule = await Test.createTestingModule({
            providers: [
            FilesService,
                {provide: MysqlService, useValue: mockMysqlService},
                {provide: MongoService, useValue: mockMongoService},
                {provide: FileUtilsService, useValue: mockFileUtilsService},
                {provide: FileResolutionService, useValue: mockFileResolutionService},
            ],
        }).compile();

        service = module.get<FilesService>(FilesService);
        mysqlService = module.get<MysqlService>(MysqlService);
        mongoService = module.get<MongoService>(MongoService);

    });
    
    async function cleanDb() {
            const db = mongoService.getDb();
            db.collection('notification').deleteMany();
            db.collection('file_data').deleteMany();

            const conn = await mysqlService.getSQL();
            await conn.execute(`delete from old_id`);
            await conn.execute(`delete from user_google`);
            await conn.execute(`delete from shared_def`);
            await conn.execute(`delete from friend`);
            await conn.execute(`delete from friend_mono`);
            await conn.execute(`delete from friend_req`);
            await conn.execute(`delete from recycle`);
            await conn.query(`set foreign_key_checks=0`);
            await conn.execute(`delete from file where user_serial<>1`);
            await conn.query(`set foreign_key_checks=1`);
            await conn.execute(`delete from user where user_serial<>1`);
    }

    beforeEach(async ()=>{
        await cleanDb();
    });

    afterEach(async () => {
        await cleanDb();
    });

    afterAll(async ()=>{
        const conn = await mysqlService.getSQL();
        const mongo = mongoService.getMongo();
        await conn.end();
        await mongo.close();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
        expect(mysqlService).toBeDefined();
        expect(mongoService).toBeDefined();
    });

    it('signupCreateDir', async()=>{
        const conn = await mysqlService.getSQL();
        await conn.execute(
            `insert into user (user_serial, user_id, name, password, salt, email) value (2, 'test', '시험자', '', '', '')`
        );
        await mysqlService.doTransaction('test', async (pool)=>{
            await service.signupCreateDir(pool, 2);
        });
        const [fileList] = await conn.execute<RowDataPacket[]>(`select * from file`);
            expect(fileList.length).toBe(7);
            expect(fileList[0].user_serial).toBe(1);
            expect(fileList[0].bookmarked).toBe('false');
            expect(fileList[0].parent_serial).toBe(1);
            expect(fileList[0].type).toBe('dir');
            expect(fileList[0].issys).toBe('true');
            expect(fileList[0].file_name).toBe('files');
            expect(fileList[0].file_serial).toBe(1);
            expect(fileList[0].to_delete).toBe('na');
            let filesDir = -1;
            const dirsPresent: string[] = [];
            for (let i = 1; i < fileList.length; i++) {
                if (fileList[i].file_name === 'files') {
                    filesDir = fileList[i].file_serial;
                }
                expect(fileList[i].user_serial).toBe(2);
                expect(fileList[i].bookmarked).toBe('false');

                expect(SysdirType.arr.includes(fileList[i].file_name)).toBe(true);
                expect(dirsPresent.includes(fileList[i].file_name)).toBe(false);
                dirsPresent.push(fileList[i].file_name);

                if (fileList[i].file_name === 'files' || fileList[i].file_name === 'upload_tmp') {
                    expect(fileList[i].parent_serial).toBe(1);
                } else {
                    expect(fileList[i].parent_serial).toBe(filesDir);
                }
                expect(fileList[i].type).toBe('dir');
                expect(fileList[i].issys).toBe('true');
                expect(fileList[i].to_delete).toBe('na');
            }
    });

    // it('moveFiles_getName', async ()=>{
    //     const conn = await mysqlService.getSQL();
    //     await conn.execute(`insert into user value ()`)
    // });
});
