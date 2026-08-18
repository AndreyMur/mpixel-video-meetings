import { NotFoundException } from '@nestjs/common';
import type { MeetingFile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingFileHandler } from './get-meeting-file.handler';
import { GetMeetingFileQuery } from './get-meeting-file.query';

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
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('GetMeetingFileHandler', () => {
  let prisma: {
    meeting: { findFirst: jest.Mock };
    meetingFile: { findFirst: jest.Mock };
  };
  let handler: GetMeetingFileHandler;

  beforeEach(() => {
    prisma = {
      meeting: { findFirst: jest.fn() },
      meetingFile: { findFirst: jest.fn() },
    };
    handler = new GetMeetingFileHandler(prisma as unknown as PrismaService);
  });

  it('returns a file for the meeting creator', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm' });
    prisma.meetingFile.findFirst.mockResolvedValue(makeFile());

    const result = await handler.execute(
      new GetMeetingFileQuery('u1', 'm', 'f1'),
    );

    expect(result.id).toBe('f1');
    expect(prisma.meetingFile.findFirst).toHaveBeenCalledWith({
      where: { id: 'f1', meetingId: 'm' },
    });
  });

  it('returns a file uploaded by the creator to an invited user', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm' });
    prisma.meetingFile.findFirst.mockResolvedValue(makeFile({ userId: 'u1' }));

    const result = await handler.execute(
      new GetMeetingFileQuery('u2', 'm', 'f1'),
    );

    expect(result.id).toBe('f1');
    expect(prisma.meetingFile.findFirst).toHaveBeenCalledWith({
      where: { id: 'f1', meetingId: 'm' },
    });
  });

  it('throws 404 for a user without meeting access', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(new GetMeetingFileQuery('u3', 'm', 'f1')),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.meetingFile.findFirst).not.toHaveBeenCalled();
  });

  it('throws 404 when the file is not found', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm' });
    prisma.meetingFile.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(new GetMeetingFileQuery('u1', 'm', 'f1')),
    ).rejects.toThrow(NotFoundException);
  });
});
