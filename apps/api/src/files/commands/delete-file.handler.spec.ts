import { NotFoundException } from '@nestjs/common';
import type { MeetingFile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { DeleteFileCommand } from './delete-file.command';
import { DeleteFileHandler } from './delete-file.handler';

function makeFile(overrides: Partial<MeetingFile> = {}): MeetingFile {
  return {
    id: 'f1',
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    size: 128,
    status: 'READY',
    objectKey: 'meetings/m/f1/x.pdf',
    metadata: null,
    previewObjectKey: null,
    transcriptObjectKey: null,
    errorMessage: null,
    meetingId: 'm',
    userId: 'uploader',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('DeleteFileHandler', () => {
  let prisma: {
    meeting: { findFirst: jest.Mock };
    meetingFile: { findFirst: jest.Mock; delete: jest.Mock };
  };
  let storage: { deleteObject: jest.Mock };
  let handler: DeleteFileHandler;

  beforeEach(() => {
    prisma = {
      meeting: { findFirst: jest.fn() },
      meetingFile: { findFirst: jest.fn(), delete: jest.fn() },
    };
    storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    handler = new DeleteFileHandler(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  it('lets the meeting creator delete a file uploaded by an invited user', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm', userId: 'creator' });
    prisma.meetingFile.findFirst.mockResolvedValue(makeFile());

    await handler.execute(new DeleteFileCommand('creator', 'm', 'f1'));

    expect(storage.deleteObject).toHaveBeenCalledWith('meetings/m/f1/x.pdf');
    expect(prisma.meetingFile.delete).toHaveBeenCalledWith({
      where: { id: 'f1' },
    });
  });

  it('lets an invited user delete a file they uploaded', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm', userId: 'creator' });
    prisma.meetingFile.findFirst.mockResolvedValue(
      makeFile({ userId: 'invited' }),
    );

    await handler.execute(new DeleteFileCommand('invited', 'm', 'f1'));

    expect(prisma.meetingFile.delete).toHaveBeenCalledWith({
      where: { id: 'f1' },
    });
  });

  it('throws 404 when the user has no meeting access', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteFileCommand('stranger', 'm', 'f1')),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.meetingFile.findFirst).not.toHaveBeenCalled();
  });

  it('throws 404 when the user is neither creator nor file owner', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm', userId: 'creator' });
    prisma.meetingFile.findFirst.mockResolvedValue(
      makeFile({ userId: 'other-uploader' }),
    );

    await expect(
      handler.execute(new DeleteFileCommand('invited', 'm', 'f1')),
    ).rejects.toThrow(NotFoundException);
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.meetingFile.delete).not.toHaveBeenCalled();
  });

  it('throws 404 when the file is not found', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm', userId: 'creator' });
    prisma.meetingFile.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteFileCommand('creator', 'm', 'f1')),
    ).rejects.toThrow(NotFoundException);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});
