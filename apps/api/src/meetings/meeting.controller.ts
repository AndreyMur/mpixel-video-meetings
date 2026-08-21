import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Meeting } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMeetingCommand } from './commands/create-meeting.command';
import { CreateConferenceTokenCommand } from './commands/create-conference-token.command';
import { DeleteMeetingCommand } from './commands/delete-meeting.command';
import { SendInvitationCommand } from './commands/send-invitation.command';
import { UpdateMeetingCommand } from './commands/update-meeting.command';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import type { ConferenceTokenResponse } from './response/conference-token.response';
import { GetMeetingQuery } from './queries/get-meeting.query';
import { GetMeetingsQuery } from './queries/get-meetings.query';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateMeetingDto,
  ): Promise<Meeting> {
    return this.commandBus.execute(
      new CreateMeetingCommand(user.sub, user.email, dto),
    );
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserPayload): Promise<Meeting[]> {
    return this.queryBus.execute(new GetMeetingsQuery(user.sub));
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<Meeting> {
    return this.queryBus.execute(new GetMeetingQuery(user.sub, id, user.email));
  }

  @Post(':id/invitations')
  sendInvitation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: SendInvitationDto,
  ): Promise<Meeting> {
    return this.commandBus.execute(
      new SendInvitationCommand(user.sub, user.email, id, dto.email),
    );
  }

  @Post(':id/conference/token')
  createConferenceToken(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ConferenceTokenResponse> {
    return this.commandBus.execute(
      new CreateConferenceTokenCommand(user.sub, user.email, id),
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
  ): Promise<Meeting> {
    return this.commandBus.execute(
      new UpdateMeetingCommand(user.sub, id, user.email, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    return this.commandBus.execute(new DeleteMeetingCommand(user.sub, id));
  }
}
