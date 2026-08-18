import type { Transporter } from 'nodemailer';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let transport: { sendMail: jest.Mock };
  let service: EmailService;

  beforeEach(() => {
    transport = { sendMail: jest.fn().mockResolvedValue(undefined) };
    service = new EmailService(
      transport as unknown as Transporter,
      'MPixel <no-reply@mpixel.local>',
    );
  });

  it('sends a meeting invitation through the SMTP transport', async () => {
    const date = new Date('2026-09-01T10:00:00Z');

    await service.sendMeetingInvitation('guest@example.com', {
      title: 'Обсуждение дизайна',
      date,
      participants: ['alice@example.com', 'guest@example.com'],
      meetingUrl: 'http://localhost:3000/meetings/m1',
    });

    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    const args = transport.sendMail.mock.calls[0] as unknown[];
    const mail = args[0] as {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(mail.from).toBe('MPixel <no-reply@mpixel.local>');
    expect(mail.to).toBe('guest@example.com');
    expect(mail.subject).toBe('Приглашение на встречу: Обсуждение дизайна');
    expect(mail.text).toContain('Обсуждение дизайна');
    expect(mail.text).toContain('guest@example.com');
    expect(mail.text).toContain('http://localhost:3000/meetings/m1');
    expect(mail.html).toContain('<h2');
    expect(mail.html).toContain('alice@example.com');
    expect(mail.html).toContain('http://localhost:3000/meetings/m1');
  });

  it('propagates SMTP transport failures', async () => {
    transport.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendMeetingInvitation('guest@example.com', {
        title: 'Встреча',
        date: new Date(),
        participants: ['guest@example.com'],
        meetingUrl: 'http://localhost:3000/meetings/m1',
      }),
    ).rejects.toThrow('smtp down');
  });
});
