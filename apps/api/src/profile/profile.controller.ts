import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordCommand } from './commands/change-password.command';
import { UpdateProfileCommand } from './commands/update-profile.command';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GetMyProfileQuery } from './queries/get-my-profile.query';
import { UserProfileResponse } from './response/user-profile.response';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
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
}
