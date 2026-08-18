import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MeetingFile } from '@prisma/client';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ProcessingService } from '../../processing/processing.service';
import { verifyFileType } from '../file-detector';
import { EXTENSION_MIME } from '../file-mime';
import { ALLOWED_EXTENSIONS } from '../files.constants';
import { UploadFileCommand } from './upload-file.command';

@CommandHandler(UploadFileCommand)
export class UploadFileHandler implements ICommandHandler<UploadFileCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly processing: ProcessingService,
  ) {}

  async execute(command: UploadFileCommand): Promise<MeetingFile> {
    try {
      if (!command.file) {
        throw new BadRequestException('Файл не передан');
      }

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

      const extension = extname(command.file.originalname)
        .toLowerCase()
        .slice(1);
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new BadRequestException(
          `Неподдерживаемый формат файла. Разрешены: ${[...ALLOWED_EXTENSIONS].join(', ')}.`,
        );
      }

      const valid = await verifyFileType(command.file.path, extension);
      if (!valid) {
        throw new BadRequestException(
          'Содержимое файла не соответствует заявленному формату.',
        );
      }

      const fileId = randomUUID();
      const safeName = basename(
        command.file.originalname,
        extname(command.file.originalname),
      )
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .slice(0, 100);
      const objectKey = `meetings/${command.meetingId}/${fileId}/${fileId}-${safeName}.${extension}`;

      let file: MeetingFile;
      try {
        file = await this.prisma.meetingFile.create({
          data: {
            id: fileId,
            name: command.file.originalname,
            mimeType: EXTENSION_MIME[extension] ?? 'application/octet-stream',
            size: command.file.size,
            status: 'PROCESSING',
            objectKey,
            meetingId: command.meetingId,
            userId: command.userId,
          },
        });

        await this.storage.putObject(
          objectKey,
          createReadStream(command.file.path),
          EXTENSION_MIME[extension],
        );
      } catch {
        await this.storage.deleteObject(objectKey).catch(() => undefined);
        await this.prisma.meetingFile
          .delete({ where: { id: fileId } })
          .catch(() => undefined);
        throw new InternalServerErrorException('Не удалось сохранить файл');
      }

      try {
        await this.processing.enqueue(fileId);
      } catch {
        file.status = 'FAILED';
        file.errorMessage = 'Не удалось поставить файл в очередь обработки';
        await this.prisma.meetingFile.update({
          where: { id: fileId },
          data: {
            status: 'FAILED',
            errorMessage: 'Не удалось поставить файл в очередь обработки',
          },
        });
      }

      return file;
    } finally {
      if (command.file) {
        await unlink(command.file.path).catch(() => undefined);
      }
    }
  }
}
