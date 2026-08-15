import { ApiError } from '@/lib/auth';
import {
  getFileExtension,
  validateMeetingFile,
  uploadMeetingFile,
} from '@/lib/files';
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

const file = new File(['content'], 'notes.txt', { type: 'text/plain' });

beforeEach(() => {
  vi.stubGlobal('XMLHttpRequest', MockXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
  MockXhr.instances.length = 0;
});

describe('getFileExtension', () => {
  it('returns the lowercase extension', () => {
    expect(getFileExtension('report.PDF')).toBe('pdf');
  });

  it('returns an empty string without an extension', () => {
    expect(getFileExtension('readme')).toBe('');
  });
});

describe('validateMeetingFile', () => {
  it('accepts an allowed extension', () => {
    expect(validateMeetingFile(new File(['x'], 'notes.pdf'))).toBeNull();
  });

  it('rejects a disallowed extension with a readable message', () => {
    expect(validateMeetingFile(new File(['x'], 'evil.exe'))).toContain(
      'Неподдерживаемый формат файла',
    );
  });

  it('rejects an oversized file', () => {
    const big = new File([new Uint8Array(51 * 1024 * 1024)], 'notes.pdf');
    expect(validateMeetingFile(big)).toContain('50 МБ');
  });
});

describe('uploadMeetingFile', () => {
  it('sends a POST with the bearer token', async () => {
    const promise = uploadMeetingFile('meeting-1', 'token-1', file);
    const xhr = MockXhr.instances[0];
    expect(xhr.openedMethod).toBe('POST');
    expect(xhr.openedUrl).toBe('/api/meetings/meeting-1/files');
    expect(xhr.headers.Authorization).toBe('Bearer token-1');
    expect(xhr.sent).toBe(true);

    xhr.complete(201, JSON.stringify({ id: 'file-1' }));
    await expect(promise).resolves.toEqual({ id: 'file-1' });
  });

  it('reports upload progress', async () => {
    const onProgress = vi.fn();
    const promise = uploadMeetingFile('meeting-1', 'token-1', file, onProgress);
    const xhr = MockXhr.instances[0];

    xhr.emitProgress(250, 1000);
    xhr.emitProgress(1000, 1000);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith({ loaded: 1000, total: 1000 });

    xhr.complete(201, JSON.stringify({ id: 'file-1' }));
    await expect(promise).resolves.toBeDefined();
  });

  it('rejects with an ApiError carrying the backend message', async () => {
    const promise = uploadMeetingFile('meeting-1', 'token-1', file);
    const xhr = MockXhr.instances[0];

    xhr.complete(400, JSON.stringify({ message: 'Файл не передан' }));
    await expect(promise).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Файл не передан',
    });
  });

  it('rejects with ApiError status 401', async () => {
    const promise = uploadMeetingFile('meeting-1', 'token-1', file);
    const xhr = MockXhr.instances[0];

    xhr.complete(401, JSON.stringify({ message: 'Unauthorized' }));
    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });

  it('rejects on a network error', async () => {
    const promise = uploadMeetingFile('meeting-1', 'token-1', file);
    const xhr = MockXhr.instances[0];

    xhr.failWith('error');
    await expect(promise).rejects.toThrow('Не удалось загрузить файл');
  });

  it('rejects when the request is aborted', async () => {
    const promise = uploadMeetingFile('meeting-1', 'token-1', file);
    const xhr = MockXhr.instances[0];

    xhr.failWith('abort');
    await expect(promise).rejects.toThrow('Загрузка прервана');
  });
});
