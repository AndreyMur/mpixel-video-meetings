import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FILE_PROCESSING_QUEUE } from '../processing/processing.constants';
import type { FileProcessingJob } from '../processing/processing.constants';
import { MetadataService } from '../processing/process-tools/metadata.service';
import { PreviewService } from '../processing/process-tools/preview.service';
import { StorageService } from '../storage/storage.service';

@Processor(FILE_PROCESSING_QUEUE, {
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? '1'),
})
@Injectable()
export class FileProcessingProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly metadataService: MetadataService,
    private readonly previewService: PreviewService,
  ) {
    super();
  }

  async process(job: Job<FileProcessingJob>): Promise<void> {
    const file = await this.prisma.meetingFile.findUnique({
      where: { id: job.data.meetingFileId },
    });
    if (!file) {
      return;
    }

    await this.prisma.meetingFile.update({
      where: { id: file.id },
      data: { status: 'PROCESSING', errorMessage: null },
    });

    const workDir = join(tmpdir(), `mpixel-worker-${randomUUID()}`);
    const extension = extname(file.name).toLowerCase().replace(/^\./, '');
    const sourcePath = join(workDir, `source.${extension || 'bin'}`);
    try {
      await mkdir(workDir, { recursive: true });
      await this.storage.downloadToFile(file.objectKey, sourcePath);

      const metadata = await this.metadataService.extract(file, sourcePath);
      const processing: Record<string, string> = {};

      const previewObjectKey = await this.guard('preview', processing, () =>
        this.previewService.generate(file, sourcePath, workDir),
      );

      await this.prisma.meetingFile.update({
        where: { id: file.id },
        data: {
          status: 'READY',
          metadata: { ...metadata, processing },
          previewObjectKey: previewObjectKey ?? null,
          errorMessage: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.meetingFile.update({
        where: { id: file.id },
        data: { status: 'FAILED', errorMessage: message.slice(0, 1000) },
      });
      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  private async guard(
    label: string,
    tracking: Record<string, string>,
    action: () => Promise<string | undefined>,
  ): Promise<string | undefined> {
    try {
      const value = await action();
      tracking[label] = value ? 'ok' : 'skipped';
      return value;
    } catch {
      tracking[label] = 'failed';
      return undefined;
    }
  }
}
