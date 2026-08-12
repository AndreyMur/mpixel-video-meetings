import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeetingCommand } from './create-meeting.command';

@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<CreateMeetingCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateMeetingCommand): Promise<Meeting> {
    return this.prisma.meeting.create({
      data: {
        title: command.dto.title,
        date: new Date(command.dto.date),
        participants: command.dto.participants,
        userId: command.userId,
      },
    });
  }
}
