import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { DeleteFileCommand } from './delete-file.command';

@CommandHandler(DeleteFileCommand)
export class DeleteFileHandler implements ICommandHandler<DeleteFileCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(command: DeleteFileCommand): Promise<void> {
    const meeting = await this.prisma.meeting.findFirst({
      where: {
        id: command.meetingId,
        OR: [
          { userId: command.userId },
          { accesses: { some: { userId: command.userId } } },
        ],
      },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const file = await this.prisma.meetingFile.findFirst({
      where: {
        id: command.fileId,
        meetingId: command.meetingId,
      },
    });
    if (
      !file ||
      (meeting.userId !== command.userId && file.userId !== command.userId)
    ) {
      throw new NotFoundException('File not found');
    }

    await Promise.all(
      [file.objectKey, file.previewObjectKey, file.transcriptObjectKey]
        .filter((key): key is string => Boolean(key))
        .map((key) => this.storage.deleteObject(key).catch(() => undefined)),
    );
    await this.prisma.meetingFile.delete({ where: { id: file.id } });
  }
}
