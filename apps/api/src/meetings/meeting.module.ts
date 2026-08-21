import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { LiveKitModule } from '../livekit/livekit.module';
import { MeetingController } from './meeting.controller';
import { CreateConferenceTokenHandler } from './commands/create-conference-token.handler';
import { CreateMeetingHandler } from './commands/create-meeting.handler';
import { DeleteMeetingHandler } from './commands/delete-meeting.handler';
import { SendInvitationHandler } from './commands/send-invitation.handler';
import { UpdateMeetingHandler } from './commands/update-meeting.handler';
import { MeetingInvitationService } from './meeting-invitation.service';
import { GetMeetingHandler } from './queries/get-meeting.handler';
import { GetMeetingsHandler } from './queries/get-meetings.handler';

@Module({
  imports: [CqrsModule, AuthModule, EmailModule, LiveKitModule],
  controllers: [MeetingController],
  providers: [
    CreateConferenceTokenHandler,
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
