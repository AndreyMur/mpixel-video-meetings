import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingInvitationService } from '../meeting-invitation.service';
import { UpdateMeetingCommand } from './update-meeting.command';

@CommandHandler(UpdateMeetingCommand)
export class UpdateMeetingHandler implements ICommandHandler<UpdateMeetingCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: MeetingInvitationService,
  ) {}

  async execute(command: UpdateMeetingCommand): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: command.meetingId, userId: command.userId },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const updated = await this.prisma.meeting.update({
      where: { id: command.meetingId },
      data: {
        title: command.dto.title,
        date: command.dto.date ? new Date(command.dto.date) : undefined,
        participants: command.dto.participants,
      },
    });
    if (meetingChanged(meeting, updated)) {
      await this.invitations.sendForMeeting(updated);
    }
    return updated;
  }
}

function meetingChanged(before: Meeting, after: Meeting): boolean {
  return (
    before.title !== after.title ||
    before.date.getTime() !== after.date.getTime() ||
    before.participants.length !== after.participants.length ||
    before.participants.some(
      (participant, index) => participant !== after.participants[index],
    )
  );
}
