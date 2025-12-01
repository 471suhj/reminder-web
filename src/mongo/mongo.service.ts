import { Injectable } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';

@Injectable()
export class MongoService {
    #client: MongoClient;
    #database: Db;

    constructor(){
        this.#client = new MongoClient("mongodb://localhost:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.5.8");
        this.#database = this.#client.db('reminder_web');
    }

    getDb(): Db{
        return this.#database;
    }

    getMongo(): MongoClient{
        return this.#client;
    }
}
