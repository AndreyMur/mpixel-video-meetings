import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const password = 'Password123!';

const uniqueEmail = (): string =>
  `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

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

interface ProfileResponse {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

describe('Profile (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /users/me', () => {
    it('returns the current user profile with null avatarUrl', async () => {
      const user = await registerUser(app);

      const response = await request(app.getHttpServer())
        .get('/users/me')
        .set(auth(user.token))
        .expect(200);

      const body = response.body as ProfileResponse;
      expect(body.email).toBe(user.email);
      expect(body.name).toBeNull();
      expect(body.avatarUrl).toBeNull();
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('returns 401 with an invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/me')
        .set(auth('not-a-jwt'))
        .expect(401);
    });
  });

  describe('PATCH /users/me', () => {
    it('saves the display name', async () => {
      const user = await registerUser(app);

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set(auth(user.token))
        .send({ name: 'Alice' })
        .expect(200);

      const body = response.body as ProfileResponse;
      expect(body.name).toBe('Alice');

      const fetched = await request(app.getHttpServer())
        .get('/users/me')
        .set(auth(user.token))
        .expect(200);
      expect((fetched.body as ProfileResponse).name).toBe('Alice');
    });

    it('clears the name when an empty value is sent', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .patch('/users/me')
        .set(auth(user.token))
        .send({ name: 'Alice' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch('/users/me')
        .set(auth(user.token))
        .send({ name: '' })
        .expect(200);

      expect((response.body as ProfileResponse).name).toBeNull();
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .patch('/users/me')
        .send({ name: 'Alice' })
        .expect(401);
    });
  });

  describe('PATCH /users/me/password', () => {
    it('changes the password with a correct old password', async () => {
      const user = await registerUser(app);
      const newPassword = 'NewPassword123!';

      await request(app.getHttpServer())
        .patch('/users/me/password')
        .set(auth(user.token))
        .send({ oldPassword: password, newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password })
        .expect(401);

      await request(app.getHttpServer())
        .get('/users/me')
        .set(auth(user.token))
        .expect(200);
    });

    it('rejects an incorrect old password and keeps the password', async () => {
      const user = await registerUser(app);

      const response = await request(app.getHttpServer())
        .patch('/users/me/password')
        .set(auth(user.token))
        .send({
          oldPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
        })
        .expect(400);

      expect((response.body as { message: string }).message).toContain(
        'Неверный старый пароль',
      );

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password })
        .expect(200);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .patch('/users/me/password')
        .send({ oldPassword: password, newPassword: 'NewPassword123!' })
        .expect(401);
    });

    it('returns 400 for a too-short new password', async () => {
      const user = await registerUser(app);

      await request(app.getHttpServer())
        .patch('/users/me/password')
        .set(auth(user.token))
        .send({ oldPassword: password, newPassword: 'short' })
        .expect(400);
    });
  });
});
