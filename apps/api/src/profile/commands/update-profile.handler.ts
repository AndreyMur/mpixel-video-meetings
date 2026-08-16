import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { toProfileResponse } from '../response/user-profile.response';
import { UserProfileResponse } from '../response/user-profile.response';
import { UpdateProfileCommand } from './update-profile.command';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler implements ICommandHandler<UpdateProfileCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateProfileCommand): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: command.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const name =
      command.dto.name === undefined
        ? undefined
        : command.dto.name.trim() || null;

    const updated = await this.prisma.user.update({
      where: { id: command.userId },
      data: { name },
    });

    return toProfileResponse(updated);
  }
}
