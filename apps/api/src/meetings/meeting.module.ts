import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { MeetingController } from './meeting.controller';
import { CreateMeetingHandler } from './commands/create-meeting.handler';
import { DeleteMeetingHandler } from './commands/delete-meeting.handler';
import { UpdateMeetingHandler } from './commands/update-meeting.handler';
import { GetMeetingHandler } from './queries/get-meeting.handler';
import { GetMeetingsHandler } from './queries/get-meetings.handler';

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [MeetingController],
  providers: [
    CreateMeetingHandler,
    DeleteMeetingHandler,
    UpdateMeetingHandler,
    GetMeetingHandler,
    GetMeetingsHandler,
  ],
})
export class MeetingsModule {}
