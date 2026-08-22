import { getConferenceToken } from '@/lib/conference';
import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getConferenceToken', () => {
  it('sends a POST with the bearer token and parses the token response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(201, { token: 'livekit-jwt' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getConferenceToken('token-1', 'm1')).resolves.toEqual({
      token: 'livekit-jwt',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/meetings/m1/conference/token');
    const request = init as RequestInit;
    expect(request.method).toBe('POST');
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer token-1',
    });
  });

  it.each([401, 403, 404])(
    'throws an ApiError with status %i when the backend rejects the request',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(jsonResponse(status, { message: 'Нет доступа' })),
      );

      await expect(getConferenceToken('token-1', 'm1')).rejects.toMatchObject({
        name: 'ApiError',
        status,
        message: 'Нет доступа',
      });
    },
  );
});
