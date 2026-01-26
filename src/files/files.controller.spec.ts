import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MysqlService } from 'src/mysql/mysql.service';
import { MongoService } from 'src/mongo/mongo.service';
import { FileResolutionService } from './file-resolution.service';
import { FileUtilsService } from './file-utils.service';
import httpMocks from 'node-mocks-http';

describe('FilesController', () => {
    let controller: FilesController;

    const ConnMock = {
        execute: jest.fn(),
        query: jest.fn(),
    };

    const mockMysqlService = {
        getSQL: jest.fn(async ()=>{return ConnMock}),

        doTransaction: jest.fn(async (name: string, process: Function)=>{
            process(ConnMock, {rback: false});
        }),
        //(servicename: string, process: (connection: PoolConnMock, rb: {rback: boolean})=>Promise<void>): Promise<void> {

    

        doQuery: jest.fn(async (name: string, process: Function)=>{
            process(ConnMock);
        }),
        //(servicename: string, process: (connection: Pool)=>Promise<void>): Promise<void> {

    };

    const mockMongoService = {

    };

    const mockFilesService = {};
    const mockFileResoultionService = {};
    const mockFileUtilsService = {
        getUserRoot: jest.fn(()=>{
            throw new Error('cat');
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [FilesController],
            providers: [
                {provide: FilesService, useValue: mockFilesService},
                {provide: FileResolutionService, useValue: mockFileResoultionService},
                {provide: FileUtilsService, useValue: mockFileUtilsService},
                {provide: MysqlService, useValue: mockMysqlService},
                {provide: MongoService, useValue: mockMongoService},
            ],
        }).compile();

        controller = module.get<FilesController>(FilesController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('cat', async ()=>{
        const req = httpMocks.createRequest();
        await expect(controller.postManage(2, req, 1)).rejects.toThrow('cat');
    });

    // 목표: putMove에 대해서만 작성, sql이 다양한 error/결과를 반환할 때, 그리고 다양한 호출을 받을 때 분기가 잘 일어나는지만 확인.
    // 부적절한 input에서 적절히 실패하는지 확인
    // it('should not permdel', () => {
    //     //expect(controller.delRecycle()).toBe();
    // }, 10000);
});
