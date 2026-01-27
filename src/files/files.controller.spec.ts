import { Test, TestingModule } from '@nestjs/testing';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MysqlService } from 'src/mysql/mysql.service';
import { MongoService } from 'src/mongo/mongo.service';
import { FileResolutionService } from './file-resolution.service';
import { FileUtilsService } from './file-utils.service';
import httpMocks from 'node-mocks-http';
import dotenv from 'dotenv';

describe('FilesController', () => {
    dotenv.config({path: 'pfx_pass.env'});

    let controller: FilesController;
    let mysqlService: MysqlService;
    let mongoService: MongoService;

    const mockMysqlService = new MysqlService(true);
    const mockMongoService = new MongoService(true);

    const mockFilesService = {};
    const mockFileResoultionService = {};
    const mockFileUtilsService: object = {};

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
        mysqlService = module.get<MysqlService>(MysqlService);
        mongoService = module.get<MongoService>(MongoService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('mock should be used', async ()=>{
        const req = httpMocks.createRequest();
        mockFileUtilsService['getUserRoot'] = jest.fn(()=>{throw new Error('mock is used');});
        await expect(controller.postManage(2, req, 1)).rejects.toThrow('mock is used');
        mockFileUtilsService['getUserRoot'] = undefined;
    });

});
