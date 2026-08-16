import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { verifyImageType } from '../image-detector';
import { AVATAR_EXTENSION_MIME } from '../avatar.constants';
import { UploadAvatarCommand } from './upload-avatar.command';
import {
  toProfileResponse,
  UserProfileResponse,
} from '../response/user-profile.response';

@CommandHandler(UploadAvatarCommand)
export class UploadAvatarHandler implements ICommandHandler<UploadAvatarCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async execute(command: UploadAvatarCommand): Promise<UserProfileResponse> {
    try {
      if (!command.file) {
        throw new BadRequestException('Файл не передан');
      }

      const extension = extname(command.file.originalname)
        .toLowerCase()
        .slice(1);
      if (!AVATAR_EXTENSION_MIME[extension]) {
        throw new BadRequestException(
          'Неподдерживаемый формат изображения. Разрешены: png, jpg, jpeg, webp.',
        );
      }

      const valid = await verifyImageType(command.file.path, extension);
      if (!valid) {
        throw new BadRequestException(
          'Содержимое файла не соответствует заявленному формату.',
        );
      }

      const user = await this.prisma.user.findUnique({
        where: { id: command.userId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const previousKey = user.avatarObjectKey;
      const objectKey = `avatars/${command.userId}/${randomUUID()}.${extension}`;

      let updated: User;
      try {
        await this.storage.putObject(
          objectKey,
          createReadStream(command.file.path),
          AVATAR_EXTENSION_MIME[extension],
        );
        updated = await this.prisma.user.update({
          where: { id: command.userId },
          data: { avatarObjectKey: objectKey },
        });
      } catch {
        await this.storage.deleteObject(objectKey).catch(() => undefined);
        throw new InternalServerErrorException('Не удалось сохранить аватар');
      }

      if (previousKey) {
        await this.storage.deleteObject(previousKey).catch(() => undefined);
      }

      return toProfileResponse(updated);
    } finally {
      if (command.file) {
        await unlink(command.file.path).catch(() => undefined);
      }
    }
  }
}
