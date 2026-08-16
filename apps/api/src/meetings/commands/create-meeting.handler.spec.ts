import type { Meeting } from '@prisma/client';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingInvitationService } from '../meeting-invitation.service';
import { CreateMeetingCommand } from './create-meeting.command';
import { CreateMeetingHandler } from './create-meeting.handler';

function makeMeeting(id: string): Meeting {
  return {
    id,
    title: 'Обсуждение дизайна',
    date: new Date('2026-09-01T10:00:00Z'),
    participants: ['alice@example.com', 'bob@example.com'],
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
      new MeetingInvitationService(emailService as unknown as EmailService),
    );
  });

  it('creates the meeting and sends an invitation to each participant', async () => {
    prisma.meeting.create.mockResolvedValue(makeMeeting('m1'));

    const result = await handler.execute(
      new CreateMeetingCommand('u1', {
        title: 'Обсуждение дизайна',
        date: '2026-09-01T10:00:00Z',
        participants: ['alice@example.com', 'bob@example.com'],
      }),
    );

    expect(result.id).toBe('m1');
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledTimes(2);
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({ title: 'Обсуждение дизайна' }),
    );
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'bob@example.com',
      expect.objectContaining({
        participants: ['alice@example.com', 'bob@example.com'],
      }),
    );
  });

  it('returns the meeting even when invitations fail to send', async () => {
    prisma.meeting.create.mockResolvedValue(makeMeeting('m1'));
    emailService.sendMeetingInvitation.mockRejectedValue(
      new Error('smtp down'),
    );

    const result = await handler.execute(
      new CreateMeetingCommand('u1', {
        title: 'Обсуждение дизайна',
        date: '2026-09-01T10:00:00Z',
        participants: ['alice@example.com'],
      }),
    );

    expect(result.id).toBe('m1');
  });
});
