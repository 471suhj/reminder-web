import { Global, Module } from '@nestjs/common';
import { MongoService } from './mongo.service';

@Global()
@Module({
    providers: [{provide: MongoService, useValue: new MongoService(false)}],
    exports: [{provide: MongoService, useExisting: MongoService}],
})
export class MongoModule {}
