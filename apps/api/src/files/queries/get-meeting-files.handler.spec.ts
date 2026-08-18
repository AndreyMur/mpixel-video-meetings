import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingFilesHandler } from './get-meeting-files.handler';
import { GetMeetingFilesQuery } from './get-meeting-files.query';

describe('GetMeetingFilesHandler', () => {
  let prisma: {
    meeting: { findFirst: jest.Mock };
    meetingFile: { findMany: jest.Mock };
  };
  let handler: GetMeetingFilesHandler;

  beforeEach(() => {
    prisma = {
      meeting: { findFirst: jest.fn() },
      meetingFile: { findMany: jest.fn().mockResolvedValue([]) },
    };
    handler = new GetMeetingFilesHandler(prisma as unknown as PrismaService);
  });

  it('lists files for the meeting creator', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm' });

    const result = await handler.execute(new GetMeetingFilesQuery('u1', 'm'));

    expect(result).toEqual([]);
    expect(prisma.meeting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'm',
          OR: [{ userId: 'u1' }, { accesses: { some: { userId: 'u1' } } }],
        },
      }),
    );
  });

  it('lists files for an invited user with access', async () => {
    prisma.meeting.findFirst.mockResolvedValue({ id: 'm' });

    const result = await handler.execute(new GetMeetingFilesQuery('u2', 'm'));

    expect(result).toEqual([]);
    expect(prisma.meetingFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { meetingId: 'm' } }),
    );
  });

  it('throws 404 for a user without meeting access', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(new GetMeetingFilesQuery('u3', 'm')),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.meetingFile.findMany).not.toHaveBeenCalled();
  });
});
