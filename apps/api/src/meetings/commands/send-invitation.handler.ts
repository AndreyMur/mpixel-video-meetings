import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingInvitationService } from '../meeting-invitation.service';
import { SendInvitationCommand } from './send-invitation.command';

@CommandHandler(SendInvitationCommand)
export class SendInvitationHandler implements ICommandHandler<SendInvitationCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: MeetingInvitationService,
  ) {}

  async execute(command: SendInvitationCommand): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: command.meetingId },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    if (meeting.userId !== command.userId) {
      throw new ForbiddenException('Only the organizer can send invitations');
    }
    if (command.email.toLowerCase() === command.organizerEmail.toLowerCase()) {
      throw new BadRequestException('Cannot invite the meeting organizer');
    }
    const participant = meeting.participants.find(
      (item) => item.toLowerCase() === command.email.toLowerCase(),
    );
    if (!participant) {
      throw new BadRequestException(
        'Email is not a participant of the meeting',
      );
    }

    await this.invitations.sendInvitation(meeting, participant);
    return meeting;
  }
}
