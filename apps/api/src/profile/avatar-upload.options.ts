import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { AVATAR_ALLOWED_EXTENSIONS } from './avatar.constants';

const avatarUploadDir = join(tmpdir(), 'mpixel-avatar-uploads');
mkdirSync(avatarUploadDir, { recursive: true });

export function createAvatarUploadOptions(
  configService: ConfigService,
): MulterOptions {
  const maxSize = Number(configService.get('MAX_AVATAR_SIZE_BYTES', '5242880'));

  return {
    storage: diskStorage({
      destination: avatarUploadDir,
      filename: (_req, _file, callback) => {
        callback(null, randomUUID());
      },
    }),
    limits: { fileSize: maxSize },
    defParamCharset: 'utf8',
    fileFilter: (_req, file, callback) => {
      const extension = extname(file.originalname).toLowerCase().slice(1);
      if (!AVATAR_ALLOWED_EXTENSIONS.has(extension)) {
        return callback(
          new BadRequestException(
            `Неподдерживаемый формат изображения: ${extension || 'без расширения'}. Разрешены: png, jpg, jpeg, webp.`,
          ),
          false,
        );
      }
      callback(null, true);
    },
  };
}
