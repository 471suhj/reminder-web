import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { ProfilesController } from './profiles.controller';
import { FilesModule } from 'src/files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [FriendsController, ProfilesController],
})
export class FriendsModule {}
