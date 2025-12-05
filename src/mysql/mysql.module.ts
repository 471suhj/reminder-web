import { Module, Global } from '@nestjs/common';
import { MysqlService } from './mysql.service';
import { MysqlOrmService } from './mysql-orm.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Euser } from './user.entity';
import { Efile } from './file.entity';
import { Eshared_def } from './shared_def.entity';
import { Efriend } from './friend.entity';
import { Efriend_mono } from './friend_mono.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Euser, Efile, Eshared_def, Efriend, Efriend_mono])],
  providers: [MysqlService, MysqlOrmService],
  exports: [MysqlService, MysqlOrmService],
})
export class MysqlModule {}
