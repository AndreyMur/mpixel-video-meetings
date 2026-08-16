import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Response } from 'express';
import { Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { ChangePasswordCommand } from './commands/change-password.command';
import { DeleteAvatarCommand } from './commands/delete-avatar.command';
import { UpdateProfileCommand } from './commands/update-profile.command';
import { UploadAvatarCommand } from './commands/upload-avatar.command';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AvatarUploadInterceptor } from './interceptors/avatar-upload.interceptor';
import { GetAvatarQuery } from './queries/get-avatar.query';
import type { AvatarResult } from './queries/get-avatar.handler';
import { GetMyProfileQuery } from './queries/get-my-profile.query';
import { UserProfileResponse } from './response/user-profile.response';

const streamPipeline = promisify(pipeline);

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly storage: StorageService,
  ) {}

  @Get()
  getProfile(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<UserProfileResponse> {
    return this.queryBus.execute(new GetMyProfileQuery(user.sub));
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    return this.commandBus.execute(new UpdateProfileCommand(user.sub, dto));
  }

  @Patch('password')
  changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.commandBus.execute(new ChangePasswordCommand(user.sub, dto));
  }

  @Post('avatar')
  @UseInterceptors(AvatarUploadInterceptor)
  uploadAvatar(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserProfileResponse> {
    return this.commandBus.execute(new UploadAvatarCommand(user.sub, file));
  }

  @Get('avatar')
  async getAvatar(
    @CurrentUser() user: CurrentUserPayload,
    @Res() response: Response,
  ): Promise<void> {
    const avatar = await this.queryBus.execute<GetAvatarQuery, AvatarResult>(
      new GetAvatarQuery(user.sub),
    );
    const object = await this.storage.getObject(avatar.objectKey);
    const body = object.Body as Readable;

    response.setHeader('Content-Type', avatar.mimeType);
    response.setHeader('Cache-Control', 'private, max-age=3600');

    const onAbort = (): void => {
      if (!response.writableEnded) {
        body.destroy();
      }
    };
    response.on('close', onAbort);
    await streamPipeline(body, response);
  }

  @Delete('avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAvatar(@CurrentUser() user: CurrentUserPayload): Promise<void> {
    return this.commandBus.execute(new DeleteAvatarCommand(user.sub));
  }
}
