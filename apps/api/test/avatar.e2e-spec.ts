import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PayloadTooLargeFilter } from './../src/files/filters/payload-too-large.filter';

const password = 'Password123!';

const uniqueEmail = (): string =>
  `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

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

const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);

interface ProfileResponse {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

describe('Avatar (e2e)', () => {
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

  describe('POST /users/me/avatar', () => {
    it('uploads a valid png avatar and exposes avatarUrl', async () => {
      const user = await registerUser(app);

      const response = await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set(auth(user.token))
        .attach('file', Buffer.concat([PNG_MAGIC, Buffer.alloc(64)]), {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        email: user.email,
        name: null,
        avatarUrl: '/users/me/avatar',
      });

      const profile = await request(app.getHttpServer())
        .get('/users/me')
        .set(auth(user.token))
        .expect(200);
      expect((profile.body as ProfileResponse).avatarUrl).toBe(
        '/users/me/avatar',
      );
    });

    it('replaces a previous avatar on re-upload', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set(auth(user.token))
        .attach('file', Buffer.concat([PNG_MAGIC, Buffer.alloc(32)]), {
          filename: 'first.png',
          contentType: 'image/png',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set(auth(user.token))
        .attach('file', Buffer.concat([PNG_MAGIC, Buffer.alloc(64)]), {
          filename: 'second.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect((response.body as ProfileResponse).avatarUrl).toBe(
        '/users/me/avatar',
      );
    });

    it('returns 413 for an avatar larger than 5 MB', async () => {
      const user = await registerUser(app);
      const bigAvatar = Buffer.concat([
        PNG_MAGIC,
        Buffer.alloc(6 * 1024 * 1024),
      ]);

      const response = await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set(auth(user.token))
        .attach('file', bigAvatar, {
          filename: 'big.png',
          contentType: 'image/png',
        })
        .expect(413);

      expect((response.body as { message: string }).message).toBe(
        'Аватар превышает максимальный размер 5 МБ',
      );
    });

    it('returns 400 for a non-image file', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set(auth(user.token))
        .attach('file', Buffer.from('#!/bin/sh echo hi'), {
          filename: 'script.sh',
          contentType: 'application/x-sh',
        })
        .expect(400);
    });

    it('returns 400 when content does not match an image extension', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set(auth(user.token))
        .attach('file', Buffer.from('%PDF-1.4 not an image'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(400);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .post('/users/me/avatar')
        .attach('file', Buffer.concat([PNG_MAGIC, Buffer.alloc(16)]), {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(401);
    });
  });

  describe('GET /users/me/avatar', () => {
    it('streams the uploaded avatar', async () => {
      const user = await registerUser(app);
      const avatarBytes = Buffer.concat([PNG_MAGIC, Buffer.alloc(64)]);

      await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set(auth(user.token))
        .attach('file', avatarBytes, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/users/me/avatar')
        .set(auth(user.token))
        .expect(200);

      expect(response.headers['content-type']).toContain('image/png');
      expect(response.body).toEqual(avatarBytes);
    });

    it('returns 404 when no avatar is set', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .get('/users/me/avatar')
        .set(auth(user.token))
        .expect(404);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/users/me/avatar').expect(401);
    });
  });

  describe('DELETE /users/me/avatar', () => {
    it('deletes the avatar and clears avatarUrl', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .post('/users/me/avatar')
        .set(auth(user.token))
        .attach('file', Buffer.concat([PNG_MAGIC, Buffer.alloc(32)]), {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete('/users/me/avatar')
        .set(auth(user.token))
        .expect(204);

      const profile = await request(app.getHttpServer())
        .get('/users/me')
        .set(auth(user.token))
        .expect(200);
      expect((profile.body as ProfileResponse).avatarUrl).toBeNull();

      await request(app.getHttpServer())
        .get('/users/me/avatar')
        .set(auth(user.token))
        .expect(404);
    });

    it('returns 204 when no avatar is set', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .delete('/users/me/avatar')
        .set(auth(user.token))
        .expect(204);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).delete('/users/me/avatar').expect(401);
    });
  });
});
