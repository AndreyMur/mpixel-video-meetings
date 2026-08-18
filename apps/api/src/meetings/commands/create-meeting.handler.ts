import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Meeting } from '@prisma/client';
import { MeetingInvitationService } from '../meeting-invitation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeetingCommand } from './create-meeting.command';

@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<CreateMeetingCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: MeetingInvitationService,
  ) {}

  async execute(command: CreateMeetingCommand): Promise<Meeting> {
    const participants = [
      ...new Set([command.email, ...(command.dto.participants ?? [])]),
    ];
    const meeting = await this.prisma.meeting.create({
      data: {
        title: command.dto.title,
        description: command.dto.description,
        date: new Date(command.dto.date),
        participants,
        userId: command.userId,
      },
    });
    await this.invitations.sendForMeeting(meeting, command.email);
    return meeting;
  }
}
