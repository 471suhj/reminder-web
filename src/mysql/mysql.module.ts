import { Module, Global } from '@nestjs/common';
import { MysqlService } from './mysql.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Euser } from './user.entity';
import { Efile } from './file.entity';
import { Eshared_def } from './shared_def.entity';
import { Efriend } from './friend.entity';
import { Efriend_mono } from './friend_mono.entity';
import { Ebookmark } from 'src/mysql/bookmark.entity';
import { Erecycle } from './recycle.entity';
import { Efriend_mul } from './friend_mul.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Euser, Efile, Eshared_def, Efriend, Efriend_mono, Ebookmark, Erecycle, Efriend_mul])],
  providers: [MysqlService],
  exports: [MysqlService],
})
export class MysqlModule {}
