import type { Meeting } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingInvitationService } from '../meeting-invitation.service';
import { CreateMeetingCommand } from './create-meeting.command';
import { CreateMeetingHandler } from './create-meeting.handler';

function makeMeeting(participants: string[]): Meeting {
  return {
    id: 'm1',
    title: 'Обсуждение дизайна',
    date: new Date('2026-09-01T10:00:00Z'),
    participants,
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('CreateMeetingHandler', () => {
  let prisma: { meeting: { create: jest.Mock } };
  let emailService: { sendMeetingInvitation: jest.Mock };
  let handler: CreateMeetingHandler;

  beforeEach(() => {
    prisma = { meeting: { create: jest.fn() } };
    emailService = {
      sendMeetingInvitation: jest.fn().mockResolvedValue(undefined),
    };
    handler = new CreateMeetingHandler(
      prisma as unknown as PrismaService,
      new MeetingInvitationService(
        emailService as unknown as EmailService,
        {
          get: jest.fn().mockReturnValue('http://localhost:3000'),
        } as unknown as ConfigService,
      ),
    );
  });

  it('stores the creator as a participant and invites only the others', async () => {
    prisma.meeting.create.mockImplementation(
      ({ data }: { data: { participants: string[] } }) =>
        makeMeeting(data.participants),
    );

    const result = await handler.execute(
      new CreateMeetingCommand('u1', 'organizer@example.com', {
        title: 'Обсуждение дизайна',
        date: '2026-09-01T10:00:00Z',
        participants: ['alice@example.com', 'bob@example.com'],
      }),
    );

    expect(prisma.meeting.create).toHaveBeenCalledWith({
      data: {
        title: 'Обсуждение дизайна',
        description: undefined,
        date: new Date('2026-09-01T10:00:00Z'),
        participants: [
          'organizer@example.com',
          'alice@example.com',
          'bob@example.com',
        ],
        userId: 'u1',
      },
    });
    expect(result.participants).toEqual([
      'organizer@example.com',
      'alice@example.com',
      'bob@example.com',
    ]);
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledTimes(2);
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({ title: 'Обсуждение дизайна' }),
    );
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'bob@example.com',
      expect.objectContaining({
        participants: [
          'organizer@example.com',
          'alice@example.com',
          'bob@example.com',
        ],
      }),
    );
    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalledWith(
      'organizer@example.com',
      expect.anything(),
    );
  });

  it('keeps at least the creator as a participant and sends no invitations', async () => {
    prisma.meeting.create.mockImplementation(
      ({ data }: { data: { participants: string[] } }) =>
        makeMeeting(data.participants),
    );

    const result = await handler.execute(
      new CreateMeetingCommand('u1', 'organizer@example.com', {
        title: 'Обсуждение дизайна',
        date: '2026-09-01T10:00:00Z',
      }),
    );

    expect(result.participants).toEqual(['organizer@example.com']);
    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('deduplicates the creator email when it is also listed as a participant', async () => {
    prisma.meeting.create.mockImplementation(
      ({ data }: { data: { participants: string[] } }) =>
        makeMeeting(data.participants),
    );

    const result = await handler.execute(
      new CreateMeetingCommand('u1', 'organizer@example.com', {
        title: 'Обсуждение дизайна',
        date: '2026-09-01T10:00:00Z',
        participants: ['organizer@example.com', 'alice@example.com'],
      }),
    );

    expect(result.participants).toEqual([
      'organizer@example.com',
      'alice@example.com',
    ]);
  });

  it('returns the meeting even when invitations fail to send', async () => {
    prisma.meeting.create.mockResolvedValue(
      makeMeeting(['organizer@example.com', 'alice@example.com']),
    );
    emailService.sendMeetingInvitation.mockRejectedValue(
      new Error('smtp down'),
    );

    const result = await handler.execute(
      new CreateMeetingCommand('u1', 'organizer@example.com', {
        title: 'Обсуждение дизайна',
        date: '2026-09-01T10:00:00Z',
        participants: ['alice@example.com'],
      }),
    );

    expect(result.id).toBe('m1');
  });
});
