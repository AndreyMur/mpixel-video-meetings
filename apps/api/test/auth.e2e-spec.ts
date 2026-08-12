import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const password = 'Password123!';

const uniqueEmail = (): string =>
  `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

interface AuthResponse {
  accessToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

function jwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  expect(parts).toHaveLength(3);
  return JSON.parse(
    Buffer.from(parts[1], 'base64url').toString('utf-8'),
  ) as JwtPayload;
}

function expectValidJwt(token: unknown): asserts token is string {
  expect(typeof token).toBe('string');
  if (typeof token !== 'string') return;
  expect(token.split('.')).toHaveLength(3);
  expect(jwtPayload(token).exp).toEqual(expect.any(Number));
}

describe('Auth (e2e)', () => {
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

  describe('POST /auth/register', () => {
    it('returns 201 with a JWT accessToken and persists the user', async () => {
      const credentials = { email: uniqueEmail(), password };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(201);

      const body = response.body as AuthResponse;
      expectValidJwt(body.accessToken);
      expect(jwtPayload(body.accessToken).email).toBe(credentials.email);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(200);
    });

    it('returns 409 when the email is already registered', async () => {
      const credentials = { email: uniqueEmail(), password };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(409);
    });

    it('returns 400 for an invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password })
        .expect(400);
    });

    it('returns 400 when the password is too short', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with a JWT accessToken for correct credentials', async () => {
      const credentials = { email: uniqueEmail(), password };
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(200);

      const body = response.body as AuthResponse;
      expectValidJwt(body.accessToken);
      expect(jwtPayload(body.accessToken).email).toBe(credentials.email);
    });

    it('returns 401 for a wrong password', async () => {
      const credentials = { email: uniqueEmail(), password };
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: credentials.email, password: 'WrongPassword123!' })
        .expect(401);
    });

    it('returns 401 for an unknown email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail(), password })
        .expect(401);
    });

    it('does not create a user', async () => {
      const credentials = { email: uniqueEmail(), password };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(credentials)
        .expect(201);
    });

    it('returns 400 for an invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password })
        .expect(400);
    });
  });
});
