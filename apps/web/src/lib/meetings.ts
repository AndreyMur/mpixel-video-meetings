import { parseError, type Meeting } from '@/lib/auth';

export interface MeetingInput {
  title: string;
  description?: string;
  date: string;
  participants: string[];
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function parseParticipants(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export function validateParticipants(value: string): string | null {
  const emails = parseParticipants(value);
  const invalid = emails.find((email) => !EMAIL_REGEX.test(email));
  if (invalid) {
    return `Некорректный email: ${invalid}`;
  }
  return null;
}

export function toDatetimeLocal(date: string): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export async function createMeeting(
  token: string,
  input: MeetingInput,
): Promise<Meeting> {
  const res = await fetch('/api/meetings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as Meeting;
}

export async function updateMeeting(
  token: string,
  meetingId: string,
  input: MeetingInput,
): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${meetingId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as Meeting;
}

export async function deleteMeeting(
  token: string,
  meetingId: string,
): Promise<void> {
  const res = await fetch(`/api/meetings/${meetingId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await parseError(res);
  }
}

export async function sendMeetingInvitation(
  token: string,
  meetingId: string,
  email: string,
): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${meetingId}/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as Meeting;
}
