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
    title: 'Sprint planning',
    description: null,
    date: new Date('2026-09-01T10:00:00.000Z'),
    participants: ['alice@example.com'],
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UpdateMeetingHandler', () => {
  let prisma: { meeting: { findFirst: jest.Mock; update: jest.Mock } };
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

  it('updates all provided fields', async () => {
    const meeting = makeMeeting();
    prisma.meeting.findFirst.mockResolvedValue(meeting);
    prisma.meeting.update.mockResolvedValue(
      makeMeeting({ title: 'New title', description: 'Desc' }),
    );

    await handler.execute(
      new UpdateMeetingCommand('u1', 'm1', {
        title: 'New title',
        description: 'Desc',
        date: '2026-09-02T10:00:00.000Z',
        participants: ['bob@example.com'],
      }),
    );

    expect(prisma.meeting.findFirst).toHaveBeenCalledWith({
      where: { id: 'm1', userId: 'u1' },
    });
    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {
        title: 'New title',
        description: 'Desc',
        date: new Date('2026-09-02T10:00:00.000Z'),
        participants: ['bob@example.com'],
      },
    });
  });

  it('updates only fields present in the payload', async () => {
    prisma.meeting.findFirst.mockResolvedValue(makeMeeting());
    prisma.meeting.update.mockResolvedValue(
      makeMeeting({ title: 'Only title' }),
    );

    await handler.execute(
      new UpdateMeetingCommand('u1', 'm1', { title: 'Only title' }),
    );

    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { title: 'Only title' },
    });
  });

  it('ignores null values for non-nullable fields', async () => {
    prisma.meeting.findFirst.mockResolvedValue(makeMeeting());
    prisma.meeting.update.mockResolvedValue(makeMeeting());

    await handler.execute(
      new UpdateMeetingCommand('u1', 'm1', {
        title: null,
        date: null,
        participants: null,
      }),
    );

    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: {},
    });
    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('clears description with an explicit null', async () => {
    prisma.meeting.findFirst.mockResolvedValue(
      makeMeeting({ description: 'Old desc' }),
    );
    prisma.meeting.update.mockResolvedValue(makeMeeting());

    await handler.execute(
      new UpdateMeetingCommand('u1', 'm1', { description: null }),
    );

    expect(prisma.meeting.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { description: null },
    });
  });

  it('sends an updated invitation to every participant when the meeting changed', async () => {
    prisma.meeting.findFirst.mockResolvedValue(makeMeeting());
    const updated = makeMeeting({
      title: 'New title',
      participants: ['alice@example.com', 'bob@example.com'],
    });
    prisma.meeting.update.mockResolvedValue(updated);

    await handler.execute(
      new UpdateMeetingCommand('u1', 'm1', {
        title: 'New title',
        participants: ['alice@example.com', 'bob@example.com'],
      }),
    );

    expect(emailService.sendMeetingInvitation).toHaveBeenCalledTimes(2);
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'bob@example.com',
      expect.objectContaining({ title: 'New title' }),
    );
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({
        participants: ['alice@example.com', 'bob@example.com'],
      }),
    );
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
        new UpdateMeetingCommand('u1', 'm1', { title: 'New title' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.meeting.update).not.toHaveBeenCalled();
    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });
});
