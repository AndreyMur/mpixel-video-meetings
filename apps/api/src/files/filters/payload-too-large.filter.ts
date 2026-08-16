import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(PayloadTooLargeException)
export class PayloadTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isAvatar = request.path.includes('/users/me/avatar');
    const maxSizeBytes = Number(
      isAvatar
        ? (process.env.MAX_AVATAR_SIZE_BYTES ?? 5242880)
        : (process.env.MAX_FILE_SIZE_BYTES ?? 52428800),
    );
    const maxSizeMb = Math.floor(maxSizeBytes / (1024 * 1024));
    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: isAvatar
        ? `Аватар превышает максимальный размер ${maxSizeMb} МБ`
        : `Файл превышает максимальный размер ${maxSizeMb} МБ`,
    });
  }
}
