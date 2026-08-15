import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { FILE_PROCESSING_QUEUE } from './processing.constants';
import { processingOptionsProvider } from './processing.options';
import { ProcessingService } from './processing.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: { url: configService.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    BullModule.registerQueue({ name: FILE_PROCESSING_QUEUE }),
  ],
  providers: [processingOptionsProvider, ProcessingService],
  exports: [ProcessingService, BullModule],
})
export class ProcessingModule {}
