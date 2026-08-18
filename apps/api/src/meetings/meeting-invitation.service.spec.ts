import type { Meeting } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { MeetingInvitationService } from './meeting-invitation.service';

function makeMeeting(
  overrides: Partial<Pick<Meeting, 'title' | 'date' | 'participants'>> = {},
): Pick<Meeting, 'id' | 'title' | 'date' | 'participants'> {
  return {
    id: 'm1',
    title: 'Встреча',
    date: new Date('2026-09-01T10:00:00Z'),
    participants: ['organizer@example.com', 'alice@example.com'],
    ...overrides,
  };
}

describe('MeetingInvitationService', () => {
  let emailService: { sendMeetingInvitation: jest.Mock };
  let service: MeetingInvitationService;

  beforeEach(() => {
    emailService = {
      sendMeetingInvitation: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    } as unknown as ConfigService;
    service = new MeetingInvitationService(
      emailService as unknown as EmailService,
      configService,
    );
  });

  it('sends an invitation to every participant except the organizer with a meeting link', async () => {
    const meeting = makeMeeting();

    await service.sendForMeeting(meeting, 'organizer@example.com');

    expect(emailService.sendMeetingInvitation).toHaveBeenCalledTimes(1);
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      {
        title: 'Встреча',
        date: meeting.date,
        participants: ['organizer@example.com', 'alice@example.com'],
        meetingUrl: 'http://localhost:3000/meetings/m1',
      },
    );
  });

  it('builds the meeting link from the configured frontend URL', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('https://meet.example.com/'),
    } as unknown as ConfigService;
    service = new MeetingInvitationService(
      emailService as unknown as EmailService,
      configService,
    );

    await service.sendInvitation(makeMeeting(), 'alice@example.com');

    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({
        meetingUrl: 'https://meet.example.com/meetings/m1',
      }),
    );
  });

  it('falls back to the default frontend URL when FRONTEND_URL is empty', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('   '),
    } as unknown as ConfigService;
    service = new MeetingInvitationService(
      emailService as unknown as EmailService,
      configService,
    );

    await service.sendInvitation(makeMeeting(), 'alice@example.com');

    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({
        meetingUrl: 'http://localhost:3000/meetings/m1',
      }),
    );
  });

  it('does not send anything when there are no participants besides the organizer', async () => {
    await service.sendForMeeting(
      makeMeeting({ participants: ['organizer@example.com'] }),
      'organizer@example.com',
    );

    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('does not send anything when there are no participants', async () => {
    await service.sendForMeeting(
      makeMeeting({ participants: [] }),
      'organizer@example.com',
    );

    expect(emailService.sendMeetingInvitation).not.toHaveBeenCalled();
  });

  it('keeps sending to the remaining participants when one fails', async () => {
    emailService.sendMeetingInvitation.mockRejectedValueOnce(
      new Error('smtp down'),
    );

    await expect(
      service.sendForMeeting(
        makeMeeting({
          participants: [
            'organizer@example.com',
            'alice@example.com',
            'bob@example.com',
          ],
        }),
        'organizer@example.com',
      ),
    ).resolves.toBeUndefined();

    expect(emailService.sendMeetingInvitation).toHaveBeenCalledTimes(2);
  });

  it('does not throw when a single invitation fails to send', async () => {
    emailService.sendMeetingInvitation.mockRejectedValue(
      new Error('smtp down'),
    );

    await expect(
      service.sendInvitation(makeMeeting(), 'alice@example.com'),
    ).resolves.toBeUndefined();
  });
});
