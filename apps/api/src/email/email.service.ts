import { Inject, Injectable } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { MAIL_FROM, MAIL_TRANSPORT } from './email.constants';
import {
  buildInvitationHtml,
  buildInvitationText,
  type MeetingInvitationData,
} from './invitation.template';

@Injectable()
export class EmailService {
  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: Transporter,
    @Inject(MAIL_FROM) private readonly from: string,
  ) {}

  async sendMeetingInvitation(
    to: string,
    meeting: MeetingInvitationData,
  ): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to,
      subject: `Приглашение на встречу: ${meeting.title}`,
      text: buildInvitationText(meeting),
      html: buildInvitationHtml(meeting),
    });
  }
}
