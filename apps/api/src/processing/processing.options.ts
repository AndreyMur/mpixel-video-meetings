import { ConfigService } from '@nestjs/config';
import { FILE_PROCESSING_OPTIONS } from './processing.constants';
import type { FileProcessingOptions } from './processing.constants';

export const processingOptionsProvider = {
  provide: FILE_PROCESSING_OPTIONS,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): FileProcessingOptions => ({
    attempts: toPositiveInt(configService.get<string>('WORKER_ATTEMPTS'), 3),
    backoffDelay: toPositiveInt(
      configService.get<string>('WORKER_BACKOFF_MS'),
      5000,
    ),
  }),
};

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
