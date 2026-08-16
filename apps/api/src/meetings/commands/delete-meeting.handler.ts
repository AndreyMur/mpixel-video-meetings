import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { DeleteMeetingCommand } from './delete-meeting.command';

@CommandHandler(DeleteMeetingCommand)
export class DeleteMeetingHandler implements ICommandHandler<DeleteMeetingCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteMeetingCommand): Promise<void> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: command.meetingId, userId: command.userId },
      include: { _count: { select: { files: true } } },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    if (meeting._count.files > 0) {
      throw new ConflictException(
        'Cannot delete meeting with files; delete the files first',
      );
    }

    await this.prisma.meeting.delete({ where: { id: meeting.id } });
  }
}
