import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import type { Provider } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { createAvatarUploadOptions } from './avatar-upload.options';
import { AVATAR_UPLOAD_OPTIONS } from './avatar.constants';
import { ChangePasswordHandler } from './commands/change-password.handler';
import { DeleteAvatarHandler } from './commands/delete-avatar.handler';
import { UpdateProfileHandler } from './commands/update-profile.handler';
import { UploadAvatarHandler } from './commands/upload-avatar.handler';
import { AvatarUploadInterceptor } from './interceptors/avatar-upload.interceptor';
import { ProfileController } from './profile.controller';
import { GetAvatarHandler } from './queries/get-avatar.handler';
import { GetMyProfileHandler } from './queries/get-my-profile.handler';

const avatarUploadOptionsProvider: Provider = {
  provide: AVATAR_UPLOAD_OPTIONS,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    createAvatarUploadOptions(configService),
};

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [ProfileController],
  providers: [
    avatarUploadOptionsProvider,
    GetMyProfileHandler,
    UpdateProfileHandler,
    ChangePasswordHandler,
    UploadAvatarHandler,
    DeleteAvatarHandler,
    GetAvatarHandler,
    AvatarUploadInterceptor,
  ],
})
export class ProfileModule {}
