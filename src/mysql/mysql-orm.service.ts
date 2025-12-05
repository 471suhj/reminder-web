import { Logger, Injectable, InternalServerErrorException, HttpException } from '@nestjs/common';
import mysql, { Pool, PoolConnection } from 'mysql2/promise';

@Injectable()
export class MysqlOrmService {

    private readonly logger = new Logger(MysqlOrmService.name);

    
}