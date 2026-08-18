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

    const { title, description, date, participants } = command.dto;
    const updated = await this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        ...(title != null && { title }),
        ...(description !== undefined && { description }),
        ...(date != null && { date: new Date(date) }),
        ...(participants != null && {
          participants: [...new Set([command.email, ...participants])],
        }),
      },
    });
    if (meetingChanged(meeting, updated)) {
      await this.invitations.sendForMeeting(updated, command.email);
    }
    return updated;
  }
}

function meetingChanged(before: Meeting, after: Meeting): boolean {
  return (
    before.title !== after.title ||
    before.description !== after.description ||
    before.date.getTime() !== after.date.getTime() ||
    before.participants.length !== after.participants.length ||
    before.participants.some(
      (participant, index) => participant !== after.participants[index],
    )
  );
}
