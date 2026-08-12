import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { MeetingController } from './meeting.controller';
import { CreateMeetingHandler } from './commands/create-meeting.handler';
import { GetMeetingHandler } from './queries/get-meeting.handler';
import { GetMeetingsHandler } from './queries/get-meetings.handler';

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [MeetingController],
  providers: [CreateMeetingHandler, GetMeetingHandler, GetMeetingsHandler],
})
export class MeetingsModule {}
