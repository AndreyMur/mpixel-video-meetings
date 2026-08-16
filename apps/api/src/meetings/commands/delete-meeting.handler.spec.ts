import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeleteMeetingCommand } from './delete-meeting.command';
import { DeleteMeetingHandler } from './delete-meeting.handler';

type MeetingWithCount = Meeting & { _count: { files: number } };

function makeMeeting(
  overrides: Partial<MeetingWithCount> = {},
): MeetingWithCount {
  return {
    id: 'm1',
    title: 'Sprint planning',
    description: null,
    date: new Date('2026-09-01T10:00:00.000Z'),
    participants: ['alice@example.com'],
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { files: 0 },
    ...overrides,
  };
}

describe('DeleteMeetingHandler', () => {
  let prisma: {
    meeting: { findFirst: jest.Mock; delete: jest.Mock };
  };
  let handler: DeleteMeetingHandler;

  beforeEach(() => {
    prisma = { meeting: { findFirst: jest.fn(), delete: jest.fn() } };
    handler = new DeleteMeetingHandler(prisma as unknown as PrismaService);
  });

  it('deletes a meeting without files', async () => {
    prisma.meeting.findFirst.mockResolvedValue(makeMeeting());
    prisma.meeting.delete.mockResolvedValue(makeMeeting());

    await handler.execute(new DeleteMeetingCommand('u1', 'm1'));

    expect(prisma.meeting.delete).toHaveBeenCalledWith({
      where: { id: 'm1' },
    });
  });

  it('throws ConflictException and keeps the meeting when it has files', async () => {
    prisma.meeting.findFirst.mockResolvedValue(
      makeMeeting({ _count: { files: 2 } }),
    );

    await expect(
      handler.execute(new DeleteMeetingCommand('u1', 'm1')),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.meeting.delete).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for a foreign or nonexistent meeting', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteMeetingCommand('u1', 'm1')),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.meeting.delete).not.toHaveBeenCalled();
  });
});
