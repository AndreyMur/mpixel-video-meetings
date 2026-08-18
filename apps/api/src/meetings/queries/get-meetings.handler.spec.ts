import type { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingsHandler } from './get-meetings.handler';
import { GetMeetingsQuery } from './get-meetings.query';

function makeMeeting(id: string, userId: string): Meeting {
  return {
    id,
    title: 'Design review',
    description: null,
    date: new Date('2026-09-01T10:00:00Z'),
    participants: ['alice@example.com'],
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('GetMeetingsHandler', () => {
  let prisma: { meeting: { findMany: jest.Mock } };
  let handler: GetMeetingsHandler;

  beforeEach(() => {
    prisma = { meeting: { findMany: jest.fn() } };
    handler = new GetMeetingsHandler(prisma as unknown as PrismaService);
  });

  it('returns meetings created by the user', async () => {
    prisma.meeting.findMany.mockResolvedValue([makeMeeting('m1', 'u1')]);

    const result = await handler.execute(new GetMeetingsQuery('u1'));

    expect(result.map((meeting) => meeting.id)).toEqual(['m1']);
    expect(prisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ userId: 'u1' }, { accesses: { some: { userId: 'u1' } } }],
        },
      }),
    );
  });

  it('returns meetings the user has access to after accepting an invitation', async () => {
    const owned = makeMeeting('m1', 'u1');
    const invited = makeMeeting('m2', 'u2');
    prisma.meeting.findMany.mockResolvedValue([invited, owned]);

    const result = await handler.execute(new GetMeetingsQuery('u1'));

    expect(result.map((meeting) => meeting.id)).toEqual(['m2', 'm1']);
    expect(prisma.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ userId: 'u1' }, { accesses: { some: { userId: 'u1' } } }],
        },
      }),
    );
  });

  it('returns no meetings for a user without ownership or access', async () => {
    prisma.meeting.findMany.mockResolvedValue([]);

    const result = await handler.execute(new GetMeetingsQuery('u1'));

    expect(result).toEqual([]);
  });
});
