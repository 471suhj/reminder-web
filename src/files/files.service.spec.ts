import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { FileUtilsService } from './file-utils.service';
import { FileResolutionService } from './file-resolution.service';
import { MysqlService } from 'src/mysql/mysql.service';
import { MongoService } from 'src/mongo/mongo.service';
import { RowDataPacket } from 'mysql2';
import { SysdirType } from './sysdir.type';
import dotenv from 'dotenv';
import { FileMoveResDto } from './file-move-res.dto';
import { rejects } from 'assert';


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
        replaceNames: jest.fn()
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

        const conn = await mysqlService.getSQL();
        await conn.execute(
            `insert into user (user_serial, user_id, name, password, salt, email) values (2, 'test', '시험자', '', '', ''), (3, 'test2', '시험자2', '', '', '')`
        );
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

    it('signupCreateDir', async ()=>{
        await mysqlService.doTransaction('test', async (pool)=>{
            await service.signupCreateDir(pool, 2);
        });

        const conn = await mysqlService.getSQL();
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

    describe('FilesService with existing files', ()=>{
        const strInsertFile = `insert into file (user_serial, bookmarked, parent_serial, type, issys, file_name, file_serial, last_renamed, mark, copy_origin) values ?`;

        const fileDate = new Date();
        fileDate.setMilliseconds(0);

        async function setupFiles() {
            const conn = await mysqlService.getSQL();

            let arrFiles = [[
                [2, 'false', 1, 'dir', 'true', 'files', 2, fileDate, 'false', 0],
                [2, 'false', 1, 'dir', 'true', 'upload_tmp', 3, fileDate, 'false', 0],
                [3, 'false', 1, 'dir', 'true', 'files', 102, fileDate, 'false', 0],
                [3, 'false', 1, 'dir', 'true', 'upload_tmp', 103, fileDate, 'false', 0],
            ]];

            await conn.query(strInsertFile, arrFiles);

            arrFiles = [[
                [2, 'false', 2, 'dir', 'true', 'bookmarks', 4, fileDate, 'false', 0],
                [2, 'false', 2, 'dir', 'true', 'inbox', 5, fileDate, 'false', 0],
                [2, 'false', 2, 'dir', 'true', 'shared', 6, fileDate, 'false', 0],
                [2, 'false', 2, 'dir', 'true', 'recycle', 7, fileDate, 'false', 0],
                [3, 'false', 102, 'dir', 'true', 'bookmarks', 104, fileDate, 'false', 0],
                [3, 'false', 102, 'dir', 'true', 'inbox', 105, fileDate, 'false', 0],
                [3, 'false', 102, 'dir', 'true', 'shared', 106, fileDate, 'false', 0],
                [3, 'false', 102, 'dir', 'true', 'recycle', 107, fileDate, 'false', 0],
            ]];

            await conn.query(strInsertFile, arrFiles);
        }

        beforeEach(async ()=>{
            await setupFiles();
        });


        it('renameFile should not rename sysdirs', async ()=>{
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(false);

            await mysqlService.doTransaction('test', async (pool)=>{
                await expect(
                    service.renameFile(pool, 2, 2, {id: 6, timestamp: fileDate}, 'cat')
                ).rejects.toThrow('잘못된 폴더입니다.');
            });
        });
    
        it('renameFile should block when parent info is incorrect', async ()=>{
            
            const conn = await mysqlService.getSQL();

            let arrFiles = [[
                [2, 'false', 2, 'file', 'false', 'mouse', 8, fileDate, 'false', 0],
                [2, 'false', 2, 'dir', 'false', 'mouse', 9, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
    
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
            let retVal = new FileMoveResDto();
    
            await mysqlService.doTransaction('test', async (pool)=>{
                retVal = await service.renameFile(pool, 2, 9, {id: 8, timestamp: fileDate}, 'cat');
            });
    
            expect(retVal.addarr.length).toBe(0);
            expect(retVal.alreadyExists).toBeFalsy();
            expect(retVal.delarr.length).toBe(0);
            expect(retVal.expired).toBeFalsy();
            expect(retVal.failed).toEqual([[8, fileDate]]);
            expect(retVal.failmessage).toBe('존재하지 않는 파일이거나 내장 폴더입니다.');
             
        });
    
        it('renameFile should block files with incorrect timestamps', async ()=>{
            const conn = await mysqlService.getSQL();
    
            let arrFiles = [[
                [2, 'false', 2, 'file', 'false', 'mouse', 8, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
    
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true);
            let retVal = new FileMoveResDto();
    
            const newDate = new Date(fileDate);
            newDate.setHours((newDate.getHours() + 1) % 24);
    
            await mysqlService.doTransaction('test', async (pool)=>{
                retVal = await service.renameFile(pool, 2, 2, {id: 8, timestamp: newDate}, 'cat');
            });
    
            expect(retVal.addarr.length).toBe(0);
            expect(retVal.alreadyExists).toBeFalsy();
            expect(retVal.delarr.length).toBe(0);
            expect(retVal.expired).toBe(true);
            expect(retVal.failed).toEqual([[8, newDate]]);
            expect(retVal.failmessage).toBeUndefined();
        });
    
        it("renameFile should block files in others' dirs, or others' files in the user's dir", async ()=>{
            const conn = await mysqlService.getSQL();
            let arrFiles = [[
                [2, 'false', 102, 'file', 'false', 'mouse', 8, fileDate, 'false', 0], // an unlikely situation with parent folder set to user 3's.
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
    
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(false);
            
            // his own file in someone else's dir
            await mysqlService.doTransaction('test', async (pool)=>{
                await expect(
                    service.renameFile(pool, 2, 102, {id: 8, timestamp: fileDate}, 'cat')
                ).rejects.toThrow('잘못된 폴더입니다.');
            });
            
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
            let retVal = new FileMoveResDto();

            // someone else's file in his own dir
            await mysqlService.doTransaction('test', async (pool)=>{
                retVal = await service.renameFile(pool, 3, 102, {id: 8, timestamp: fileDate}, 'cat');
            });
    
            expect(retVal.addarr.length).toBe(0);
            expect(retVal.alreadyExists).toBeFalsy();
            expect(retVal.delarr.length).toBe(0);
            expect(retVal.expired).toBeFalsy();
            expect(retVal.failed).toEqual([[8, fileDate]]);
            expect(retVal.failmessage).toBe('존재하지 않는 파일이거나 내장 폴더입니다.');
        });

        it("renameFile should block others' files in others' dirs", async ()=>{
            const conn = await mysqlService.getSQL();
            let arrFiles = [[
                [3, 'false', 102, 'file', 'false', 'mouse', 108, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
    
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(false);
    
            await mysqlService.doTransaction('test', async (pool)=>{
                await expect(
                    service.renameFile(pool, 2, 102, {id: 108, timestamp: fileDate}, 'cat')
                ).rejects.toThrow('잘못된 폴더입니다.');
            });
        });
    
        it('renameFile should block files in non-files system dir', async ()=>{
            const conn = await mysqlService.getSQL();
            let arrFiles = [[
                [2, 'false', 5, 'file', 'false', 'mouse', 8, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
    
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(false);
    
            await mysqlService.doTransaction('test', async (pool)=>{
                await expect(
                    service.renameFile(pool, 2, 5, {id: 8, timestamp: fileDate}, 'cat')
                ).rejects.toThrow('잘못된 폴더입니다.');
            });
        });

        it('renameFile should block duplicates', async ()=>{
            const conn = await mysqlService.getSQL();
            let arrFiles = [[
                [2, 'false', 2, 'file', 'false', 'mouse', 8, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse2', 9, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
    
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true);
            let retVal = new FileMoveResDto();
    
            await mysqlService.doTransaction('test', async (pool)=>{
                retVal = await service.renameFile(pool, 2, 2, {id: 9, timestamp: fileDate}, 'mouse');
            });
    
            expect(retVal.addarr.length).toBe(0);
            expect(retVal.alreadyExists).toBe(true);
            expect(retVal.delarr.length).toBe(0);
            expect(retVal.expired).toBeFalsy();
            expect(retVal.failed).toEqual([[9, fileDate]]);
            expect(retVal.failmessage).toBeUndefined(); 
        });
    
        it('renameFile should allow duplicates between different types', async ()=>{
            const conn = await mysqlService.getSQL();
            const newDate = new Date(fileDate);
            newDate.setHours((newDate.getHours() + 1) % 24);

            let arrFiles = [[
                [2, 'false', 2, 'file', 'false', 'mouse', 8, newDate, 'false', 0],
                [2, 'false', 2, 'dir', 'false', 'mouse2', 9, newDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
    
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true);
            let retVal = new FileMoveResDto();
    
            await mysqlService.doTransaction('test', async (pool)=>{
                retVal = await service.renameFile(pool, 2, 2, {id: 9, timestamp: newDate}, 'mouse');
            });
    
            expect(retVal.addarr.length).toBe(1);
            expect(retVal.addarr[0]).toMatchObject({
                link: '/files?dirid=9',
                id: 9,
                isFolder: true,
                text: 'mouse',
                bookmarked: false,
            });
            expect(retVal.addarr[0].timestamp.getTime() === newDate.getTime()).toBe(false);
            expect(retVal.alreadyExists).toBeFalsy();
            expect(retVal.delarr).toEqual([{id: 9, timestamp: newDate}]);
            expect(retVal.expired).toBeFalsy();
            expect(retVal.failed.length).toBe(0);
            expect(retVal.failmessage).toBeUndefined(); 
        });

        it('renameFile should update shared_def when applicable', async ()=>{
            const conn = await mysqlService.getSQL();
            let arrFiles = [[
                [2, 'false', 2, 'file', 'false', 'mouse', 8, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );

            await conn.execute(`insert into friend_mono (user_serial_to, user_serial_from) values (2,3), (3,2)`);
            await conn.execute(`insert into friend (user_serial_to, user_serial_from) value (2,3)`);
            await conn.execute(`insert into shared_def (user_serial_to, user_serial_from, file_serial, file_name, share_type) value (3,2,8,'mouse','edit')`);
    
            mockFileUtilsService['checkAccess'] = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    
            await mysqlService.doTransaction('test', async (pool)=>{
                await service.renameFile(pool, 2, 2, {id: 8, timestamp: fileDate}, 'cat');
            });
    
            const [sharedList] = await conn.execute<RowDataPacket[]>(`select * from shared_def`);
            expect(sharedList.length).toBe(1);
            expect(sharedList[0]).toMatchObject({
                user_serial_to: 3,
                user_serial_from: 2,
                file_serial: 8,
                file_name: 'cat',
                share_type: 'edit',
            });
        });

        it('moveFiles_getName should deal with empty input', async ()=>{
            const conn = await mysqlService.getSQL();

            let arrFiles = [[
                [2, 'false', 2, 'dir', 'false', 'mouse', 8, fileDate, 'false', 0],
                [2, 'false', 2, 'dir', 'false', 'mouse2', 9, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse', 10, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse2', 11, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
            
            const fncTest = async (move: boolean)=>{
                await mysqlService.doTransaction('test', async (pool)=>{
                    const retVal = await service.moveFiles_getName(pool, 2, 2, [], move);
                    expect(retVal.arrValidFiles.size).toBe(0);
                    expect(retVal.arrFail.length).toBe(0);
                    expect(retVal.arrTypeName.length).toBe(0);
                });
            };
        
            await fncTest(true);
            await fncTest(false);
        });

        it('moveFiles_getName should deal with partial situations', async ()=>{
            const conn = await mysqlService.getSQL();

            let arrFiles = [[
                [2, 'false', 2, 'dir', 'false', 'mouse', 8, fileDate, 'false', 0],
                [2, 'false', 2, 'dir', 'false', 'mouse2', 9, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse', 10, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse2', 11, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );

            const newDate = new Date(fileDate);
            newDate.setHours((newDate.getHours() + 1) % 24);
        
            const fncTest = async (move: boolean)=>{
                await mysqlService.doTransaction('test', async (pool)=>{
                    const retVal = await service.moveFiles_getName(
                        pool, 2, 2, [[8, fileDate], [8, newDate], [9, fileDate], [9, newDate], [10, newDate], [11, fileDate], [11, newDate], [13, fileDate]], move
                    );
                    expect(retVal.arrValidFiles.size).toBe(3);
                    expect(retVal.arrValidFiles.get(8)).toEqual(fileDate);
                    expect(retVal.arrValidFiles.get(9)).toEqual(fileDate);
                    expect(retVal.arrValidFiles.get(11)).toEqual(fileDate);
                    expect(retVal.arrFail.length).toBe(5);
                    expect(retVal.arrFail).toContainEqual([8, newDate]);
                    expect(retVal.arrFail).toContainEqual([9, newDate]);
                    expect(retVal.arrFail).toContainEqual([10, newDate]);
                    expect(retVal.arrFail).toContainEqual([11, newDate]);
                    expect(retVal.arrFail).toContainEqual([13, fileDate]);                
                    expect(retVal.arrTypeName.length).toBe(3);
                    expect(retVal.arrTypeName).toContainEqual(['dir', 'mouse']);
                    expect(retVal.arrTypeName).toContainEqual(['dir', 'mouse2']);
                    expect(retVal.arrTypeName).toContainEqual(['file', 'mouse2']);
                });
            };

            await fncTest(true);
            await fncTest(false);
        });

        it('moveFiles_getName should deal with total situations', async ()=>{
            const conn = await mysqlService.getSQL();

            let arrFiles = [[
                [2, 'false', 2, 'dir', 'false', 'mouse', 8, fileDate, 'false', 0],
                [2, 'false', 2, 'dir', 'false', 'mouse2', 9, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse', 10, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse2', 11, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
        
            const fncTest = async (move: boolean)=>{
                await mysqlService.doTransaction('test', async (pool)=>{
                    const retVal = await service.moveFiles_getName(pool, 2, 2, [[8, fileDate], [9, fileDate], [11, fileDate]], move);
                    expect(retVal.arrValidFiles.size).toBe(3);
                    expect(retVal.arrValidFiles.get(8)).toEqual(fileDate);
                    expect(retVal.arrValidFiles.get(9)).toEqual(fileDate);
                    expect(retVal.arrValidFiles.get(11)).toEqual(fileDate);
                    expect(retVal.arrFail.length).toBe(0);
                    expect(retVal.arrTypeName.length).toBe(3);
                    expect(retVal.arrTypeName).toContainEqual(['dir', 'mouse']);
                    expect(retVal.arrTypeName).toContainEqual(['dir', 'mouse2']);
                    expect(retVal.arrTypeName).toContainEqual(['file', 'mouse2']);
                });
            };

            await fncTest(true);
            await fncTest(false);
        });

        it('moveFiles_getName should block unauthorized files', async ()=>{
            const conn = await mysqlService.getSQL();

            let arrFiles = [[
                [3, 'false', 2, 'dir', 'false', 'mouse', 8, fileDate, 'false', 0],
                [3, 'false', 2, 'dir', 'false', 'mouse2', 9, fileDate, 'false', 0],
                [3, 'false', 2, 'file', 'false', 'mouse', 10, fileDate, 'false', 0],
                [3, 'false', 2, 'file', 'false', 'mouse2', 11, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );
            
            const fncTest = async (move: boolean)=>{
                await mysqlService.doTransaction('test', async (pool)=>{
                    const retVal = await service.moveFiles_getName(pool, 2, 2, [[8, fileDate], [9, fileDate], [11, fileDate], [7, fileDate], [6, fileDate]], move);
                    expect(retVal.arrValidFiles.size).toBe(0);
                    expect(retVal.arrFail.length).toBe(5);
                    expect(retVal.arrFail).toContainEqual([8, fileDate]);
                    expect(retVal.arrFail).toContainEqual([9, fileDate]);
                    expect(retVal.arrFail).toContainEqual([11, fileDate]);
                    expect(retVal.arrFail).toContainEqual([7, fileDate]);
                    expect(retVal.arrFail).toContainEqual([6, fileDate]);
                    expect(retVal.arrTypeName.length).toBe(0);
                });
            };

            await fncTest(true);
            await fncTest(false);
        });

        it('moveFiles_getName should block inaccurate parent dirs', async ()=>{
            const conn = await mysqlService.getSQL();

            let arrFiles = [[
                [2, 'false', 2, 'dir', 'false', 'mouse', 8, fileDate, 'false', 0],
                [2, 'false', 2, 'dir', 'false', 'mouse2', 9, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse', 10, fileDate, 'false', 0],
                [2, 'false', 2, 'file', 'false', 'mouse2', 11, fileDate, 'false', 0],
            ]];
    
            await conn.query(
                strInsertFile, arrFiles
            );

            const fncTest = async (move: boolean)=>{
                await mysqlService.doTransaction('test', async (pool)=>{
                    const retVal = await service.moveFiles_getName(pool, 2, 5, [[8, fileDate], [9, fileDate], [11, fileDate]], move);
                    expect(retVal.arrValidFiles.size).toBe(0);
                    expect(retVal.arrFail.length).toBe(3);
                    expect(retVal.arrFail).toContainEqual([8, fileDate]);
                    expect(retVal.arrFail).toContainEqual([9, fileDate]);
                    expect(retVal.arrFail).toContainEqual([11, fileDate]);
                    expect(retVal.arrTypeName.length).toBe(0);
                });
            };

            await fncTest(true);
            await fncTest(false);
        });

    //     it('moveFiles_rename (copy) should deal with empty input', async ()=>{
    //         const conn = await mysqlService.getSQL();

    //         let arrFiles = [[
    //             [2, 'false', 2, 'dir', 'false', 'mouse', 8, fileDate, 'false', 0],
    //             [2, 'false', 2, 'dir', 'false', 'mouse2', 9, fileDate, 'false', 0],
    //             [2, 'false', 2, 'file', 'false', 'mouse', 10, fileDate, 'false', 0],
    //             [2, 'false', 2, 'file', 'false', 'mouse2', 11, fileDate, 'false', 0],
    //         ]];
    
    //         await conn.query(
    //             strInsertFile, arrFiles
    //         );
        
    //         await mysqlService.doTransaction('test', async (pool)=>{
    //             const retVal = await service.moveFiles_rename(pool, 2, false, 8, 9, []);
    //         });

    //     });
    });
    
    // should deal with successful input
    // should deal with unsuccessfully long-named input
    // should deal with same source and destination

    // moveFiles_rename (move) should

    // moveFiles_copyRecurse should deal with empty input
    // moveFiles_copyRecurse should deal with successful input
});
