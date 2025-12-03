import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { ProfilesController } from './profiles.controller';

@Module({
  providers: [FriendsService],
  controllers: [FriendsController, ProfilesController],
  exports: [FriendsService]
})
export class FriendsModule {}
