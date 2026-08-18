import { NotFoundException } from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingHandler } from './get-meeting.handler';
import { GetMeetingQuery } from './get-meeting.query';

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'm1',
    title: 'Design review',
    description: null,
    date: new Date('2026-09-01T10:00:00Z'),
    participants: ['alice@example.com'],
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('GetMeetingHandler', () => {
  let prisma: {
    meeting: { findFirst: jest.Mock; findUnique: jest.Mock };
    meetingAccess: { upsert: jest.Mock };
  };
  let handler: GetMeetingHandler;

  beforeEach(() => {
    prisma = {
      meeting: { findFirst: jest.fn(), findUnique: jest.fn() },
      meetingAccess: { upsert: jest.fn().mockResolvedValue({}) },
    };
    handler = new GetMeetingHandler(prisma as unknown as PrismaService);
  });

  it('returns the meeting for the creator without creating access', async () => {
    const meeting = makeMeeting();
    prisma.meeting.findFirst.mockResolvedValue(meeting);

    const result = await handler.execute(
      new GetMeetingQuery('u1', 'm1', 'alice@example.com'),
    );

    expect(result.id).toBe('m1');
    expect(prisma.meeting.findUnique).not.toHaveBeenCalled();
    expect(prisma.meetingAccess.upsert).not.toHaveBeenCalled();
  });

  it('returns the meeting when the user already has access', async () => {
    const meeting = makeMeeting();
    prisma.meeting.findFirst.mockResolvedValue(meeting);

    const result = await handler.execute(
      new GetMeetingQuery('u2', 'm1', 'bob@example.com'),
    );

    expect(result.id).toBe('m1');
    expect(prisma.meetingAccess.upsert).not.toHaveBeenCalled();
  });

  it('grants access by email from participants and returns the meeting', async () => {
    const meeting = makeMeeting({ participants: ['bob@example.com'] });
    prisma.meeting.findFirst.mockResolvedValue(null);
    prisma.meeting.findUnique.mockResolvedValue(meeting);

    const result = await handler.execute(
      new GetMeetingQuery('u2', 'm1', 'bob@example.com'),
    );

    expect(prisma.meetingAccess.upsert).toHaveBeenCalledWith({
      where: { meetingId_userId: { meetingId: 'm1', userId: 'u2' } },
      create: { meetingId: 'm1', userId: 'u2' },
      update: {},
    });
    expect(result.id).toBe('m1');
  });

  it('matches participant emails case-insensitively', async () => {
    const meeting = makeMeeting({ participants: ['Bob@Example.COM'] });
    prisma.meeting.findFirst.mockResolvedValue(null);
    prisma.meeting.findUnique.mockResolvedValue(meeting);

    const result = await handler.execute(
      new GetMeetingQuery('u2', 'm1', 'bob@example.com'),
    );

    expect(prisma.meetingAccess.upsert).toHaveBeenCalledWith({
      where: { meetingId_userId: { meetingId: 'm1', userId: 'u2' } },
      create: { meetingId: 'm1', userId: 'u2' },
      update: {},
    });
    expect(result.id).toBe('m1');
  });

  it('throws 404 for a user whose email is outside participants', async () => {
    const meeting = makeMeeting({ participants: ['alice@example.com'] });
    prisma.meeting.findFirst.mockResolvedValue(null);
    prisma.meeting.findUnique.mockResolvedValue(meeting);

    await expect(
      handler.execute(new GetMeetingQuery('u3', 'm1', 'mallory@example.com')),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.meetingAccess.upsert).not.toHaveBeenCalled();
  });

  it('throws 404 when the meeting does not exist', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);
    prisma.meeting.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new GetMeetingQuery('u1', 'missing', 'a@example.com')),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.meetingAccess.upsert).not.toHaveBeenCalled();
  });
});
