import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { MeetingController } from './meeting.controller';
import { CreateMeetingHandler } from './commands/create-meeting.handler';
import { DeleteMeetingHandler } from './commands/delete-meeting.handler';
import { SendInvitationHandler } from './commands/send-invitation.handler';
import { UpdateMeetingHandler } from './commands/update-meeting.handler';
import { MeetingInvitationService } from './meeting-invitation.service';
import { GetMeetingHandler } from './queries/get-meeting.handler';
import { GetMeetingsHandler } from './queries/get-meetings.handler';

@Module({
  imports: [CqrsModule, AuthModule, EmailModule],
  controllers: [MeetingController],
  providers: [
    CreateMeetingHandler,
    DeleteMeetingHandler,
    SendInvitationHandler,
    UpdateMeetingHandler,
    GetMeetingHandler,
    GetMeetingsHandler,
    MeetingInvitationService,
  ],
})
export class MeetingsModule {}
