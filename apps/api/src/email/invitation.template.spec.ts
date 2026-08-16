import {
  buildInvitationHtml,
  buildInvitationText,
} from './invitation.template';

describe('invitation template', () => {
  const meeting = {
    title: 'Обсуждение',
    date: new Date('2026-09-01T10:00:00Z'),
    participants: ['alice@example.com'],
  };

  it('builds a plain text invitation with title, date and participants', () => {
    const text = buildInvitationText(meeting);

    expect(text).toContain('Обсуждение');
    expect(text).toContain('1 сентября 2026 г.');
    expect(text).toContain('alice@example.com');
  });

  it('escapes HTML-sensitive characters in the HTML body', () => {
    const html = buildInvitationHtml({
      ...meeting,
      title: 'Встреча <script>alert(1)</script> & план',
      participants: ['a@example.com', 'b@example.com'],
    });

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;');
    expect(html).toContain('a@example.com');
  });
});
