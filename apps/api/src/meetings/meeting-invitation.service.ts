import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Meeting } from '@prisma/client';
import { EmailService } from '../email/email.service';

type InvitableMeeting = Pick<Meeting, 'id' | 'title' | 'date' | 'participants'>;

@Injectable()
export class MeetingInvitationService {
  private readonly logger = new Logger(MeetingInvitationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async sendForMeeting(
    meeting: InvitableMeeting,
    organizerEmail: string,
  ): Promise<void> {
    const recipients = meeting.participants.filter(
      (participant) => participant !== organizerEmail,
    );
    await Promise.all(
      recipients.map((participant) =>
        this.sendInvitation(meeting, participant),
      ),
    );
  }

  async sendInvitation(
    meeting: InvitableMeeting,
    recipientEmail: string,
  ): Promise<void> {
    try {
      await this.emailService.sendMeetingInvitation(recipientEmail, {
        title: meeting.title,
        date: meeting.date,
        participants: meeting.participants,
        meetingUrl: this.buildMeetingUrl(meeting.id),
      });
    } catch (error) {
      this.logger.error(
        `Failed to send meeting invitation to ${recipientEmail}: ${formatError(error)}`,
      );
    }
  }

  private buildMeetingUrl(meetingId: string): string {
    const baseUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const normalized = (baseUrl ?? '').trim() || 'http://localhost:3000';
    return `${normalized.replace(/\/+$/, '')}/meetings/${meetingId}`;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}
