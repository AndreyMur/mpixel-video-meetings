import {
  createMeeting,
  deleteMeeting,
  fromDatetimeLocal,
  parseParticipants,
  toDatetimeLocal,
  updateMeeting,
  validateParticipants,
} from '@/lib/meetings';
import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const meeting = {
  id: 'm1',
  title: 'Синк',
  description: null,
  date: '2026-08-20T10:00:00.000Z',
  participants: ['a@example.com'],
  userId: 'u1',
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};

const input = {
  title: 'Синк',
  date: '2026-08-20T10:00:00.000Z',
  participants: ['a@example.com'],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseParticipants', () => {
  it('splits emails by commas, semicolons and whitespace', () => {
    expect(parseParticipants('a@example.com, b@example.com')).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
    expect(
      parseParticipants('a@example.com;b@example.com\nc@example.com'),
    ).toEqual(['a@example.com', 'b@example.com', 'c@example.com']);
  });

  it('ignores empty parts and trims whitespace', () => {
    expect(parseParticipants('  a@example.com  ,  ,  ')).toEqual([
      'a@example.com',
    ]);
    expect(parseParticipants('')).toEqual([]);
  });
});

describe('validateParticipants', () => {
  it('returns null for valid emails', () => {
    expect(validateParticipants('a@example.com, b@example.com')).toBeNull();
  });

  it('returns null when empty', () => {
    expect(validateParticipants('')).toBeNull();
  });

  it('reports the first invalid email', () => {
    expect(validateParticipants('a@example.com, not-an-email')).toContain(
      'not-an-email',
    );
  });
});

describe('toDatetimeLocal / fromDatetimeLocal', () => {
  it('formats an ISO date as a local datetime-local value', () => {
    const local = toDatetimeLocal('2026-08-20T10:30:00.000Z');
    expect(new Date(local)).not.toBeNaN();
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('converts a datetime-local value back to an ISO string', () => {
    const iso = fromDatetimeLocal('2026-08-20T10:30');
    expect(new Date(iso).toISOString()).toBe(iso);
  });
});

describe('createMeeting', () => {
  it('sends a POST with the JSON body and parses the meeting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, meeting));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createMeeting('token-1', input)).resolves.toEqual(meeting);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/meetings');
    const request = init as RequestInit;
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body as string)).toEqual(input);
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer token-1',
      'Content-Type': 'application/json',
    });
  });

  it('throws an ApiError on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(400, { message: 'Некорректные данные' }),
        ),
    );
    await expect(createMeeting('token-1', input)).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Некорректные данные',
    });
  });
});

describe('updateMeeting', () => {
  it('sends a PATCH to the meeting endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, meeting));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateMeeting('token-1', 'm1', input)).resolves.toEqual(
      meeting,
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/meetings/m1');
    const request = init as RequestInit;
    expect(request.method).toBe('PATCH');
    expect(JSON.parse(request.body as string)).toEqual(input);
  });
});

describe('deleteMeeting', () => {
  it('sends a DELETE with the bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteMeeting('token-1', 'm1')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/meetings/m1');
    expect((init as RequestInit).method).toBe('DELETE');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Bearer token-1',
    });
  });

  it('throws when the meeting has files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          message: 'Cannot delete meeting with files; delete the files first',
        }),
      ),
    );
    await expect(deleteMeeting('token-1', 'm1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
    });
  });
});
