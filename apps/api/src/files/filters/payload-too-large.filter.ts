import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(PayloadTooLargeException)
export class PayloadTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const maxSizeBytes = Number(process.env.MAX_FILE_SIZE_BYTES ?? 52428800);
    const maxSizeMb = Math.floor(maxSizeBytes / (1024 * 1024));
    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: `Файл превышает максимальный размер ${maxSizeMb} МБ`,
    });
  }
}
