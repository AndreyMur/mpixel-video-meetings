import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ALLOWED_EXTENSIONS } from './files.constants';

const uploadDir = join(tmpdir(), 'mpixel-uploads');
mkdirSync(uploadDir, { recursive: true });

export function createFileUploadOptions(
  configService: ConfigService,
): MulterOptions {
  const maxSize = Number(configService.get('MAX_FILE_SIZE_BYTES', '52428800'));

  return {
    storage: diskStorage({
      destination: uploadDir,
      filename: (_req, _file, callback) => {
        callback(null, randomUUID());
      },
    }),
    limits: { fileSize: maxSize },
    defParamCharset: 'utf8',
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase().slice(1);
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        return callback(
          new BadRequestException(
            `Неподдерживаемый формат файла: ${extension || 'без расширения'}. Разрешены: ${[...ALLOWED_EXTENSIONS].join(', ')}.`,
          ),
          false,
        );
      }
      callback(null, true);
    },
  };
}
