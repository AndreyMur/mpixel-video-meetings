import type { Job } from 'bullmq';
import type { MeetingFile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { FileProcessingJob } from '../processing/processing.constants';
import { MetadataService } from '../processing/process-tools/metadata.service';
import { PreviewService } from '../processing/process-tools/preview.service';
import { StorageService } from '../storage/storage.service';
import { FileProcessingProcessor } from './file-processing.processor';

function makeFile(): MeetingFile {
  return {
    id: 'file-1',
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    size: 10,
    status: 'PROCESSING',
    objectKey: 'meetings/m/file-1/x.pdf',
    metadata: null,
    previewObjectKey: null,
    transcriptObjectKey: null,
    errorMessage: null,
    meetingId: 'm',
    userId: 'u',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('FileProcessingProcessor', () => {
  let prisma: {
    meetingFile: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let storage: StorageService;
  let metadataService: MetadataService;
  let previewService: PreviewService;
  let processor: FileProcessingProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      meetingFile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    storage = {
      downloadToFile: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    metadataService = {
      extract: jest.fn().mockResolvedValue({ format: 'pdf', pages: 1 }),
    } as unknown as MetadataService;
    previewService = {
      generate: jest
        .fn()
        .mockResolvedValue('meetings/m/file-1/x.pdf.preview.png'),
    } as unknown as PreviewService;

    processor = new FileProcessingProcessor(
      prisma as unknown as PrismaService,
      storage,
      metadataService,
      previewService,
    );
  });

  it('marks the file READY with metadata and preview on success', async () => {
    prisma.meetingFile.findUnique.mockResolvedValue(makeFile());

    await processor.process({
      data: { meetingFileId: 'file-1' },
    } as Job<FileProcessingJob>);

    expect(prisma.meetingFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: { status: 'PROCESSING', errorMessage: null },
    });
    expect(prisma.meetingFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: {
        status: 'READY',
        metadata: {
          format: 'pdf',
          pages: 1,
          processing: { preview: 'ok' },
        },
        previewObjectKey: 'meetings/m/file-1/x.pdf.preview.png',
        errorMessage: null,
      },
    });
  });

  it('marks the file FAILED when processing throws', async () => {
    prisma.meetingFile.findUnique.mockResolvedValue(makeFile());
    (storage.downloadToFile as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(
      processor.process({
        data: { meetingFileId: 'file-1' },
      } as Job<FileProcessingJob>),
    ).rejects.toThrow('boom');

    expect(prisma.meetingFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: { status: 'FAILED', errorMessage: 'boom' },
    });
  });

  it('still marks the file READY when only preview generation fails', async () => {
    prisma.meetingFile.findUnique.mockResolvedValue(makeFile());
    (previewService.generate as jest.Mock).mockRejectedValue(
      new Error('no tools'),
    );

    await processor.process({
      data: { meetingFileId: 'file-1' },
    } as Job<FileProcessingJob>);

    expect(prisma.meetingFile.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: {
        status: 'READY',
        metadata: {
          format: 'pdf',
          pages: 1,
          processing: { preview: 'failed' },
        },
        previewObjectKey: null,
        errorMessage: null,
      },
    });
  });

  it('does nothing when the file was deleted', async () => {
    prisma.meetingFile.findUnique.mockResolvedValue(null);

    await processor.process({
      data: { meetingFileId: 'missing' },
    } as Job<FileProcessingJob>);

    expect(prisma.meetingFile.update).not.toHaveBeenCalled();
  });
});
