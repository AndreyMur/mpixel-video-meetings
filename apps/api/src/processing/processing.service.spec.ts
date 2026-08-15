import type { Queue } from 'bullmq';
import {
  FILE_PROCESSING_JOB,
  type FileProcessingJob,
} from './processing.constants';
import { ProcessingService } from './processing.service';

describe('ProcessingService', () => {
  it('enqueues a job with retry options', async () => {
    const queue = { add: jest.fn() };
    const service = new ProcessingService(
      queue as unknown as Queue<FileProcessingJob>,
      {
        attempts: 3,
        backoffDelay: 5000,
      },
    );

    await service.enqueue('file-1');

    expect(queue.add).toHaveBeenCalledWith(
      FILE_PROCESSING_JOB,
      { meetingFileId: 'file-1' },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    );
  });
});
