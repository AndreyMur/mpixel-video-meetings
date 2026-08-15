import type { Express } from 'express';
import type { MeetingFile } from '@prisma/client';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ProcessingService } from '../../processing/processing.service';
import { verifyFileType } from '../file-detector';
import { UploadFileCommand } from './upload-file.command';
import { UploadFileHandler } from './upload-file.handler';

jest.mock('../file-detector', () => ({
  verifyFileType: jest.fn(),
}));

const mockVerify = verifyFileType as jest.Mock;

function makeStoredFile(id: string): MeetingFile {
  return {
    id,
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    size: 128,
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

describe('UploadFileHandler', () => {
  let tempDir: string;
  let prisma: {
    meeting: { findFirst: jest.Mock };
    meetingFile: { create: jest.Mock; update: jest.Mock };
  };
  let storage: { putObject: jest.Mock; deleteObject: jest.Mock };
  let processing: { enqueue: jest.Mock };
  let handler: UploadFileHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue(true);
    tempDir = await mkdtemp(join(tmpdir(), 'mpixel-upload-'));
    await writeFile(join(tempDir, 'notes.pdf'), 'fake-pdf-bytes');
    prisma = {
      meeting: { findFirst: jest.fn() },
      meetingFile: { create: jest.fn(), update: jest.fn() },
    };
    storage = {
      putObject: jest.fn(async (_key: string, body: unknown) => {
        const stream = body as NodeJS.ReadableStream;
        await new Promise<void>((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
          stream.resume();
        });
      }),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    processing = { enqueue: jest.fn().mockResolvedValue(undefined) };
    handler = new UploadFileHandler(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      processing as unknown as ProcessingService,
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeFile(): Express.Multer.File {
    return {
      fieldname: 'file',
      originalname: 'notes.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      destination: '',
      filename: 'x',
      path: join(tempDir, 'notes.pdf'),
      size: 128,
    } as Express.Multer.File;
  }

  function stubCreate(): void {
    prisma.meetingFile.create.mockImplementation(
      (args: { data: { id: string } }) => makeStoredFile(args.data.id),
    );
  }

  it('saves the file and enqueues processing', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm' });
    stubCreate();

    const result = await handler.execute(
      new UploadFileCommand('u', 'm', makeFile()),
    );

    expect(result.status).toBe('PROCESSING');
    expect(processing.enqueue).toHaveBeenCalledWith(result.id);
    expect(prisma.meetingFile.update).not.toHaveBeenCalled();
  });

  it('marks the file FAILED when enqueueing fails', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm' });
    stubCreate();
    processing.enqueue.mockRejectedValue(new Error('redis down'));

    const result = await handler.execute(
      new UploadFileCommand('u', 'm', makeFile()),
    );

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe(
      'Не удалось поставить файл в очередь обработки',
    );
    expect(prisma.meetingFile.update).toHaveBeenCalledWith({
      where: { id: result.id },
      data: {
        status: 'FAILED',
        errorMessage: 'Не удалось поставить файл в очередь обработки',
      },
    });
  });
});
