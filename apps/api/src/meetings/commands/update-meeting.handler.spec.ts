import { NotFoundException } from '@nestjs/common';
import type { Meeting } from '@prisma/client';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingInvitationService } from '../meeting-invitation.service';
import { UpdateMeetingCommand } from './update-meeting.command';
import { UpdateMeetingHandler } from './update-meeting.handler';

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'm1',
    title: 'Старое название',
    date: new Date('2026-09-01T10:00:00Z'),
    participants: ['alice@example.com', 'bob@example.com'],
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UpdateMeetingHandler', () => {
  let prisma: {
    meeting: { findFirst: jest.Mock; update: jest.Mock };
  };
  let emailService: { sendMeetingInvitation: jest.Mock };
  let handler: UpdateMeetingHandler;

  beforeEach(() => {
    prisma = { meeting: { findFirst: jest.fn(), update: jest.fn() } };
    emailService = {
      sendMeetingInvitation: jest.fn().mockResolvedValue(undefined),
    };
    handler = new UpdateMeetingHandler(
      prisma as unknown as PrismaService,
      new MeetingInvitationService(emailService as unknown as EmailService),
    );
  });

  it('updates attributes and sends an updated invitation to each participant', async () => {
    prisma.meeting.findFirst.mockResolvedValue(makeMeeting());
    const updated = makeMeeting({
      title: 'Новое название',
      participants: ['alice@example.com', 'carol@example.com'],
    });
    prisma.meeting.update.mockResolvedValue(updated);

    const result = await handler.execute(
      new UpdateMeetingCommand('u1', 'm1', {
        title: 'Новое название',
        participants: ['alice@example.com', 'carol@example.com'],
      }),
    );

    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        title: 'Новое название',
        date: undefined,
        participants: ['alice@example.com', 'carol@example.com'],
      },
    });
    expect(result.title).toBe('Новое название');
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledTimes(2);
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'carol@example.com',
      expect.objectContaining({ title: 'Новое название' }),
    );
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({
        participants: ['alice@example.com', 'carol@example.com'],
      }),
    );
  });

  it('converts a date string to a Date when updating', async () => {
    prisma.meeting.findFirst.mockResolvedValue(makeMeeting());
    prisma.meeting.update.mockResolvedValue(
      makeMeeting({ date: new Date('2026-09-02T12:00:00Z') }),
    );

    await handler.execute(
      new UpdateMeetingCommand('u1', 'm1', {
        date: '2026-09-02T12:00:00Z',
      }),
    );

    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        title: undefined,
        date: new Date('2026-09-02T12:00:00Z'),
        participants: undefined,
      },
    });
  });

  it('does not send invitations when nothing changed', async () => {
    const unchanged = makeMeeting();
    prisma.meeting.findFirst.mockResolvedValue(unchanged);
    prisma.meeting.update.mockResolvedValue(unchanged);

    await handler.execute(new UpdateMeetingCommand('u1', 'm1', {}));

    expect(prisma.meeting.update).toHaveBeenCalledTimes(1);
    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the meeting does not belong to the user', async () => {
    prisma.meeting.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute(
        new UpdateMeetingCommand('u1', 'm1', { title: 'Новое название' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.meeting.update).not.toHaveBeenCalled();
    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });
});
