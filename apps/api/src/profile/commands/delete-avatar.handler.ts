import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { DeleteAvatarCommand } from './delete-avatar.command';

@CommandHandler(DeleteAvatarCommand)
export class DeleteAvatarHandler implements ICommandHandler<DeleteAvatarCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(command: DeleteAvatarCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: command.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.avatarObjectKey) {
      return;
    }

    await this.storage.deleteObject(user.avatarObjectKey);
    await this.prisma.user.update({
      where: { id: command.userId },
      data: { avatarObjectKey: null },
    });
  }
}
