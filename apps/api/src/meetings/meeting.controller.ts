import {
  Body,
  Controller,
  Get,
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
import { UpdateMeetingCommand } from './commands/update-meeting.command';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
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
    return this.commandBus.execute(new CreateMeetingCommand(user.sub, dto));
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
    return this.queryBus.execute(new GetMeetingQuery(user.sub, id));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMeetingDto,
  ): Promise<Meeting> {
    return this.commandBus.execute(new UpdateMeetingCommand(user.sub, id, dto));
  }
}
