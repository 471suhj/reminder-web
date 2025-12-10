import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FilesModule } from 'src/files/files.module';
import { PrefsModule } from 'src/prefs/prefs.module';

@Module({
  imports: [FilesModule, PrefsModule],
  controllers: [FriendsController],
})
export class FriendsModule {}
