import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingInvitationService } from '../meeting-invitation.service';
import { SendInvitationCommand } from './send-invitation.command';
import { SendInvitationHandler } from './send-invitation.handler';

const ORGANIZER = 'organizer@example.com';

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'm1',
    title: 'Обсуждение дизайна',
    description: null,
    date: new Date('2026-09-01T10:00:00Z'),
    participants: [ORGANIZER, 'alice@example.com'],
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SendInvitationHandler', () => {
  let prisma: { meeting: { findUnique: jest.Mock } };
  let emailService: { sendMeetingInvitation: jest.Mock };
  let handler: SendInvitationHandler;

  beforeEach(() => {
    prisma = { meeting: { findUnique: jest.fn() } };
    emailService = {
      sendMeetingInvitation: jest.fn().mockResolvedValue(undefined),
    };
    handler = new SendInvitationHandler(
      prisma as unknown as PrismaService,
      new MeetingInvitationService(
        emailService as unknown as EmailService,
        {
          get: jest.fn().mockReturnValue('http://localhost:3000'),
        } as unknown as ConfigService,
      ),
    );
  });

  it('sends an invitation to a participant and returns the meeting', async () => {
    const meeting = makeMeeting();
    prisma.meeting.findUnique.mockResolvedValue(meeting);

    const result = await handler.execute(
      new SendInvitationCommand('u1', ORGANIZER, 'm1', 'alice@example.com'),
    );

    expect(prisma.meeting.findUnique).toHaveBeenCalledWith({
      where: { id: 'm1' },
    });
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledTimes(1);
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      {
        title: meeting.title,
        date: meeting.date,
        participants: meeting.participants,
        meetingUrl: 'http://localhost:3000/meetings/m1',
      },
    );
    expect(result.id).toBe('m1');
  });

  it('throws 403 when the current user is not the organizer', async () => {
    prisma.meeting.findUnique.mockResolvedValue(
      makeMeeting({ userId: 'someone-else' }),
    );

    await expect(
      handler.execute(
        new SendInvitationCommand('u1', ORGANIZER, 'm1', 'alice@example.com'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('throws 404 when the meeting does not exist', async () => {
    prisma.meeting.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(
        new SendInvitationCommand('u1', ORGANIZER, 'm1', 'alice@example.com'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 400 when inviting the organizer', async () => {
    prisma.meeting.findUnique.mockResolvedValue(makeMeeting());

    await expect(
      handler.execute(
        new SendInvitationCommand('u1', ORGANIZER, 'm1', ORGANIZER),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('matches the participant email case-insensitively', async () => {
    prisma.meeting.findUnique.mockResolvedValue(
      makeMeeting({ participants: [ORGANIZER, 'Alice@Example.com'] }),
    );

    await handler.execute(
      new SendInvitationCommand('u1', ORGANIZER, 'm1', 'alice@example.com'),
    );

    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'Alice@Example.com',
      expect.anything(),
    );
  });

  it('throws 400 when inviting the organizer with different casing', async () => {
    prisma.meeting.findUnique.mockResolvedValue(makeMeeting());

    await expect(
      handler.execute(
        new SendInvitationCommand(
          'u1',
          ORGANIZER,
          'm1',
          'Organizer@Example.com',
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('throws 400 when the email is not a meeting participant', async () => {
    prisma.meeting.findUnique.mockResolvedValue(makeMeeting());

    await expect(
      handler.execute(
        new SendInvitationCommand(
          'u1',
          ORGANIZER,
          'm1',
          'stranger@example.com',
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('returns the meeting even when the email fails to send', async () => {
    prisma.meeting.findUnique.mockResolvedValue(makeMeeting());
    emailService.sendMeetingInvitation.mockRejectedValue(
      new Error('smtp down'),
    );

    const result = await handler.execute(
      new SendInvitationCommand('u1', ORGANIZER, 'm1', 'alice@example.com'),
    );

    expect(result.id).toBe('m1');
  });
});
