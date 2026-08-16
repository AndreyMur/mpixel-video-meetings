import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { ChangePasswordHandler } from './commands/change-password.handler';
import { UpdateProfileHandler } from './commands/update-profile.handler';
import { ProfileController } from './profile.controller';
import { GetMyProfileHandler } from './queries/get-my-profile.handler';

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [ProfileController],
  providers: [GetMyProfileHandler, UpdateProfileHandler, ChangePasswordHandler],
})
export class ProfileModule {}
