import { ApiError } from '@/lib/auth';
import {
  changePassword,
  deleteAvatar,
  fetchAvatarSrc,
  getAvatarExtension,
  getProfile,
  updateName,
  uploadAvatar,
  validateAvatar,
} from '@/lib/profile';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockXhrUpload {
  handlers: Record<string, (event: unknown) => void> = {};

  addEventListener(type: string, handler: (event: unknown) => void) {
    this.handlers[type] = handler;
  }
}

class MockXhr {
  static instances: MockXhr[] = [];

  upload = new MockXhrUpload();
  handlers: Record<string, () => void> = {};
  openedMethod = '';
  openedUrl = '';
  headers: Record<string, string> = {};
  status = 0;
  responseText = '';
  sent = false;

  constructor() {
    MockXhr.instances.push(this);
  }

  open(method: string, url: string) {
    this.openedMethod = method;
    this.openedUrl = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send() {
    this.sent = true;
  }

  addEventListener(type: string, handler: () => void) {
    this.handlers[type] = handler;
  }

  emitProgress(loaded: number, total: number) {
    this.upload.handlers.progress?.({
      lengthComputable: true,
      loaded,
      total,
    });
  }

  complete(status: number, responseText: string) {
    this.status = status;
    this.responseText = responseText;
    this.handlers.load?.();
  }

  failWith(type: 'error' | 'abort') {
    this.handlers[type]?.();
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const profile = {
  email: 'user@example.com',
  name: 'Alice',
  avatarUrl: '/users/me/avatar',
};

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', MockXhr);
  URL.createObjectURL = vi.fn(() => 'blob:avatar');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  MockXhr.instances.length = 0;
  vi.restoreAllMocks();
});

describe('getAvatarExtension', () => {
  it('returns the lowercase extension', () => {
    expect(getAvatarExtension('photo.PNG')).toBe('png');
  });

  it('returns an empty string without an extension', () => {
    expect(getAvatarExtension('avatar')).toBe('');
  });
});

describe('validateAvatar', () => {
  it('accepts allowed extensions', () => {
    for (const name of [
      'avatar.png',
      'avatar.jpg',
      'avatar.jpeg',
      'avatar.webp',
    ]) {
      expect(validateAvatar(new File(['x'], name))).toBeNull();
    }
  });

  it('rejects a disallowed extension with a readable message', () => {
    expect(validateAvatar(new File(['x'], 'avatar.gif'))).toContain(
      'Неподдерживаемый формат изображения',
    );
    expect(validateAvatar(new File(['x'], 'avatar.gif'))).toContain(
      'png, jpg, jpeg, webp',
    );
  });

  it('rejects an oversized image', () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'avatar.png');
    expect(validateAvatar(big)).toContain('5 МБ');
  });
});

describe('getProfile', () => {
  it('sends a GET with the bearer token and parses the profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, profile));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getProfile('token-1')).resolves.toEqual(profile);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/me');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Bearer token-1',
    });
  });

  it('throws an ApiError on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse(500, { message: 'Ошибка сервера' })),
    );
    await expect(getProfile('token-1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'Ошибка сервера',
    });
  });
});

describe('updateName', () => {
  it('sends a PATCH with the name in the JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, profile));
    vi.stubGlobal('fetch', fetchMock);

    await expect(updateName('token-1', 'Alice')).resolves.toEqual(profile);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/me');
    const request = init as RequestInit;
    expect(request.method).toBe('PATCH');
    expect(JSON.parse(request.body as string)).toEqual({ name: 'Alice' });
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer token-1',
      'Content-Type': 'application/json',
    });
  });
});

describe('changePassword', () => {
  it('sends a PATCH with old and new passwords', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      changePassword('token-1', 'old-password', 'new-password'),
    ).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/me/password');
    const request = init as RequestInit;
    expect(request.method).toBe('PATCH');
    expect(JSON.parse(request.body as string)).toEqual({
      oldPassword: 'old-password',
      newPassword: 'new-password',
    });
  });

  it('rejects with the backend message for a wrong old password', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(400, { message: 'Неверный старый пароль' }),
        ),
    );
    await expect(
      changePassword('token-1', 'wrong', 'new-password'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Неверный старый пароль',
    });
  });
});

describe('deleteAvatar', () => {
  it('sends a DELETE with the bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteAvatar('token-1')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/users/me/avatar');
    expect((init as RequestInit).method).toBe('DELETE');
    expect((init as RequestInit).headers).toEqual({
      Authorization: 'Bearer token-1',
    });
  });
});

describe('fetchAvatarSrc', () => {
  it('returns null when the avatar is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(404, { message: 'Not found' })),
    );
    await expect(fetchAvatarSrc('token-1')).resolves.toBeNull();
  });

  it('returns an object URL for the avatar blob', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        blob: async () => new Blob(['image'], { type: 'image/png' }),
      }),
    );
    await expect(fetchAvatarSrc('token-1')).resolves.toBe('blob:avatar');
  });
});

describe('uploadAvatar', () => {
  it('sends a POST with the bearer token', async () => {
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const promise = uploadAvatar('token-1', file);
    const xhr = MockXhr.instances[0];
    expect(xhr.openedMethod).toBe('POST');
    expect(xhr.openedUrl).toBe('/api/users/me/avatar');
    expect(xhr.headers.Authorization).toBe('Bearer token-1');
    expect(xhr.sent).toBe(true);

    xhr.complete(200, JSON.stringify(profile));
    await expect(promise).resolves.toEqual(profile);
  });

  it('reports upload progress', async () => {
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const onProgress = vi.fn();
    const promise = uploadAvatar('token-1', file, onProgress);
    const xhr = MockXhr.instances[0];

    xhr.emitProgress(120, 400);
    xhr.emitProgress(400, 400);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith({ loaded: 400, total: 400 });

    xhr.complete(200, JSON.stringify(profile));
    await expect(promise).resolves.toBeDefined();
  });

  it('rejects with an ApiError carrying the backend message', async () => {
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const promise = uploadAvatar('token-1', file);
    const xhr = MockXhr.instances[0];

    xhr.complete(400, JSON.stringify({ message: 'Файл не передан' }));
    await expect(promise).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Файл не передан',
    });
  });

  it('rejects with ApiError status 401', async () => {
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const promise = uploadAvatar('token-1', file);
    const xhr = MockXhr.instances[0];

    xhr.complete(401, JSON.stringify({ message: 'Unauthorized' }));
    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });

  it('rejects on a network error', async () => {
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const promise = uploadAvatar('token-1', file);
    const xhr = MockXhr.instances[0];

    xhr.failWith('error');
    await expect(promise).rejects.toThrow('Не удалось загрузить аватар');
  });

  it('rejects when the request is aborted', async () => {
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const promise = uploadAvatar('token-1', file);
    const xhr = MockXhr.instances[0];

    xhr.failWith('abort');
    await expect(promise).rejects.toThrow('Загрузка прервана');
  });
});
