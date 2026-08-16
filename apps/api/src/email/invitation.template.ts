export interface MeetingInvitationData {
  title: string;
  date: Date;
  participants: string[];
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatInvitationDate(date: Date): string {
  return dateFormatter.format(date);
}

export function buildInvitationText(meeting: MeetingInvitationData): string {
  const lines = [
    `Вас приглашают на встречу: ${meeting.title}`,
    '',
    `Дата и время: ${formatInvitationDate(meeting.date)}`,
    '',
    'Участники:',
    ...meeting.participants.map((participant) => `- ${participant}`),
  ];
  return lines.join('\n');
}

export function buildInvitationHtml(meeting: MeetingInvitationData): string {
  const title = escapeHtml(meeting.title);
  const date = escapeHtml(formatInvitationDate(meeting.date));
  const participants = meeting.participants
    .map((participant) => `<li>${escapeHtml(participant)}</li>`)
    .join('');
  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a">',
    `<h2 style="margin:0 0 12px">Вас приглашают на встречу: ${title}</h2>`,
    `<p style="margin:0 0 8px"><strong>Дата и время:</strong> ${date}</p>`,
    '<p style="margin:0 0 4px"><strong>Участники:</strong></p>',
    `<ul style="margin:0;padding-left:20px">${participants}</ul>`,
    '</div>',
  ].join('');
}
