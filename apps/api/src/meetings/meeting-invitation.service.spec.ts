import type { Meeting } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { MeetingInvitationService } from './meeting-invitation.service';

function makeMeeting(
  overrides: Partial<Pick<Meeting, 'title' | 'date' | 'participants'>> = {},
): Pick<Meeting, 'title' | 'date' | 'participants'> {
  return {
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
    service = new MeetingInvitationService(
      emailService as unknown as EmailService,
    );
  });

  it('sends an invitation to every participant except the organizer', async () => {
    const meeting = makeMeeting();

    await service.sendForMeeting(meeting, 'organizer@example.com');

    expect(emailService.sendMeetingInvitation).toHaveBeenCalledTimes(1);
    expect(emailService.sendMeetingInvitation).toHaveBeenCalledWith(
      'alice@example.com',
      {
        title: 'Встреча',
        date: meeting.date,
        participants: ['organizer@example.com', 'alice@example.com'],
      },
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
});
