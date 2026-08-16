import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordCommand } from './change-password.command';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: command.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      command.dto.oldPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new BadRequestException('Неверный старый пароль');
    }

    const passwordHash = await bcrypt.hash(command.dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: command.userId },
      data: { passwordHash },
    });
  }
}
