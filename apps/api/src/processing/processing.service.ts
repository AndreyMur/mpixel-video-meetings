import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  FILE_PROCESSING_JOB,
  FILE_PROCESSING_OPTIONS,
  FILE_PROCESSING_QUEUE,
} from './processing.constants';
import type {
  FileProcessingJob,
  FileProcessingOptions,
} from './processing.constants';

@Injectable()
export class ProcessingService {
  constructor(
    @InjectQueue(FILE_PROCESSING_QUEUE)
    private readonly queue: Queue<FileProcessingJob>,
    @Inject(FILE_PROCESSING_OPTIONS)
    private readonly options: FileProcessingOptions,
  ) {}

  async enqueue(meetingFileId: string): Promise<void> {
    await this.queue.add(
      FILE_PROCESSING_JOB,
      { meetingFileId },
      {
        attempts: this.options.attempts,
        backoff: { type: 'exponential', delay: this.options.backoffDelay },
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    );
  }
}
