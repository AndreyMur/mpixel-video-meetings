import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMeetingCommand } from './update-meeting.command';

@CommandHandler(UpdateMeetingCommand)
export class UpdateMeetingHandler implements ICommandHandler<UpdateMeetingCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateMeetingCommand): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: command.meetingId, userId: command.userId },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const { title, description, date, participants } = command.dto;
    return this.prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        ...(title != null && { title }),
        ...(description !== undefined && { description }),
        ...(date != null && { date: new Date(date) }),
        ...(participants != null && { participants }),
      },
    });
  }
}
