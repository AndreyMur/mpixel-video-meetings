import { Injectable, Logger } from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import { EmailService } from '../email/email.service';

@Injectable()
export class MeetingInvitationService {
  private readonly logger = new Logger(MeetingInvitationService.name);

  constructor(private readonly emailService: EmailService) {}

  async sendForMeeting(
    meeting: Pick<Meeting, 'title' | 'date' | 'participants'>,
  ): Promise<void> {
    const results = await Promise.allSettled(
      meeting.participants.map((participant) =>
        this.emailService.sendMeetingInvitation(participant, {
          title: meeting.title,
          date: meeting.date,
          participants: meeting.participants,
        }),
      ),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to send meeting invitation to ${meeting.participants[index]}: ${String(result.reason)}`,
        );
      }
    });
  }
}
