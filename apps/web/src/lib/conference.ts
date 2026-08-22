import { parseError } from '@/lib/auth';

export interface ConferenceTokenResponse {
  token: string;
}

export async function getConferenceToken(
  token: string,
  meetingId: string,
): Promise<ConferenceTokenResponse> {
  const res = await fetch(`/api/meetings/${meetingId}/conference/token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as ConferenceTokenResponse;
}
