import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PayloadTooLargeFilter } from './../src/files/filters/payload-too-large.filter';

const password = 'Password123!';
const meetingDate = '2026-09-01T10:00:00.000Z';

const uniqueEmail = (): string =>
  `files_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

interface RegisteredUser {
  email: string;
  token: string;
}

async function registerUser(
  app: INestApplication<App>,
): Promise<RegisteredUser> {
  const email = uniqueEmail();
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password })
    .expect(201);
  return {
    email,
    token: (response.body as { accessToken: string }).accessToken,
  };
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Meeting files (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new PayloadTooLargeFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createMeeting(token: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/meetings')
      .set(auth(token))
      .send({ title: 'Files meeting', date: meetingDate, participants: [] })
      .expect(201);
    return (response.body as { id: string }).id;
  }

  describe('POST /meetings/:id/files', () => {
    it('uploads a file and returns 201 with PROCESSING status', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      const response = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'notes.pdf',
        status: 'PROCESSING',
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).not.toHaveProperty('objectKey');
    });

    it('preserves cyrillic filenames', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      const response = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .attach('file', Buffer.from('MPixel cyrillic test'), {
          filename: 'заметки встреча.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'заметки встреча.txt',
        status: 'PROCESSING',
      });

      const list = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect((list.body as { name: string }[])[0].name).toBe(
        'заметки встреча.txt',
      );
    });

    it('returns 413 for a file larger than the limit', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      const bigFile = Buffer.alloc(51 * 1024 * 1024);
      bigFile.write('%PDF-', 0);

      const response = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .attach('file', bigFile, {
          filename: 'big.pdf',
          contentType: 'application/pdf',
        })
        .expect(413);

      expect(response.body).toHaveProperty('message');
      expect((response.body as { message: string }).message).toBe(
        'Файл превышает максимальный размер 50 МБ',
      );
    });

    it('returns 400 for a disallowed format', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .attach('file', Buffer.from('#!/bin/sh'), {
          filename: 'script.sh',
          contentType: 'application/x-sh',
        })
        .expect(400);
    });

    it('returns 400 when content does not match the extension', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .attach('file', Buffer.from('MZ this is not a pdf'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(400);
    });

    it('returns 404 when the meeting does not exist', async () => {
      const { token } = await registerUser(app);

      await request(app.getHttpServer())
        .post('/meetings/00000000-0000-0000-0000-000000000000/files')
        .set(auth(token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(404);
    });

    it('returns 404 when uploading to a foreign meeting', async () => {
      const owner = await registerUser(app);
      const observer = await registerUser(app);
      const meetingId = await createMeeting(owner.token);

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(observer.token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(404);
    });

    it('returns 401 without a token', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(401);
    });
  });

  describe('GET /meetings/:id/files', () => {
    it('lists files of the meeting without object keys', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      const [file] = response.body as { name: string; status: string }[];
      expect(file).toMatchObject({
        name: 'notes.pdf',
        status: 'PROCESSING',
      });
      expect(file).not.toHaveProperty('objectKey');
    });

    it('returns 404 for another user', async () => {
      const owner = await registerUser(app);
      const observer = await registerUser(app);
      const meetingId = await createMeeting(owner.token);

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set(auth(observer.token))
        .expect(404);
    });

    it('returns 401 without a token', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .expect(401);
    });
  });

  describe('GET /meetings/:id/files/:fileId/download', () => {
    it('downloads the file content', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      const upload = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const fileId = (upload.body as { id: string }).id;

      const response = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${fileId}/download`)
        .set(auth(token))
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toEqual(Buffer.from('%PDF-1.4 test content'));
    });

    it('returns 404 when the file belongs to another user', async () => {
      const owner = await registerUser(app);
      const observer = await registerUser(app);
      const meetingId = await createMeeting(owner.token);

      const upload = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(owner.token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const fileId = (upload.body as { id: string }).id;

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${fileId}/download`)
        .set(auth(observer.token))
        .expect(404);
    });
  });

  describe('DELETE /meetings/:id/files/:fileId', () => {
    it('deletes the file from the list', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      const upload = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const fileId = (upload.body as { id: string }).id;

      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}/files/${fileId}`)
        .set(auth(token))
        .expect(204);

      const list = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set(auth(token))
        .expect(200);
      expect(list.body).toEqual([]);
    });

    it('returns 404 when the file belongs to another user', async () => {
      const owner = await registerUser(app);
      const observer = await registerUser(app);
      const meetingId = await createMeeting(owner.token);

      const upload = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(owner.token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const fileId = (upload.body as { id: string }).id;

      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}/files/${fileId}`)
        .set(auth(observer.token))
        .expect(404);
    });

    it('returns 404 for a non-existent file', async () => {
      const { token } = await registerUser(app);
      const meetingId = await createMeeting(token);

      await request(app.getHttpServer())
        .delete(
          `/meetings/${meetingId}/files/00000000-0000-0000-0000-000000000000`,
        )
        .set(auth(token))
        .expect(404);
    });
  });
});
