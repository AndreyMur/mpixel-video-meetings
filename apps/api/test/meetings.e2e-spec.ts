import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const password = 'Password123!';

const meetingDate = '2026-09-01T10:00:00.000Z';

const uniqueEmail = (): string =>
  `meeting_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;

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

interface MeetingPayload {
  title: string;
  date: string;
  participants: string[];
}

interface MeetingResponse extends MeetingPayload {
  id: string;
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('Meetings (e2e)', () => {
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

  describe('POST /meetings', () => {
    it('creates a meeting and returns it with 201', async () => {
      const { token } = await registerUser(app);
      const body: MeetingPayload = {
        title: 'Sprint planning',
        date: meetingDate,
        participants: ['alice@example.com', 'bob@example.com'],
      };

      const response = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(token))
        .send(body)
        .expect(201);

      expect(response.body).toMatchObject({
        title: body.title,
        participants: body.participants,
      });
      expect(response.body).toHaveProperty('id');
      expect(
        new Date((response.body as MeetingResponse).date).toISOString(),
      ).toBe(meetingDate);
    });

    it('returns 400 when the title is missing', async () => {
      const { token } = await registerUser(app);

      await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(token))
        .send({ date: meetingDate, participants: [] })
        .expect(400);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .post('/meetings')
        .send({
          title: 'Sprint planning',
          date: meetingDate,
          participants: [],
        })
        .expect(401);
    });
  });

  describe('GET /meetings', () => {
    it('returns all meetings of the current user', async () => {
      const user = await registerUser(app);
      const first: MeetingPayload = {
        title: 'First meeting',
        date: meetingDate,
        participants: [],
      };
      const second: MeetingPayload = {
        title: 'Second meeting',
        date: '2026-09-02T10:00:00.000Z',
        participants: [],
      };

      await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send(first)
        .expect(201);
      await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send(second)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/meetings')
        .set(auth(user.token))
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      const titles = (response.body as { title: string }[]).map(
        (meeting) => meeting.title,
      );
      expect(titles).toEqual(
        expect.arrayContaining(['First meeting', 'Second meeting']),
      );
    });

    it('does not return meetings of other users', async () => {
      const owner = await registerUser(app);
      const observer = await registerUser(app);

      await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(owner.token))
        .send({ title: 'Private meeting', date: meetingDate, participants: [] })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/meetings')
        .set(auth(observer.token))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/meetings').expect(401);
    });
  });

  describe('GET /meetings/:id', () => {
    it('returns a single meeting by id', async () => {
      const user = await registerUser(app);
      const body: MeetingPayload = {
        title: 'One on one',
        date: meetingDate,
        participants: ['alice@example.com'],
      };

      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send(body)
        .expect(201);

      const createdId = (created.body as MeetingResponse).id;

      const response = await request(app.getHttpServer())
        .get(`/meetings/${createdId}`)
        .set(auth(user.token))
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdId,
        title: body.title,
        participants: body.participants,
      });
    });

    it('returns 404 when the meeting is not found', async () => {
      const { token } = await registerUser(app);

      await request(app.getHttpServer())
        .get('/meetings/00000000-0000-0000-0000-000000000000')
        .set(auth(token))
        .expect(404);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .get('/meetings/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });

  describe('PATCH /meetings/:id', () => {
    it('updates attributes and participants with 200', async () => {
      const user = await registerUser(app);
      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send({
          title: 'Old title',
          date: meetingDate,
          participants: ['alice@example.com'],
        })
        .expect(201);

      const createdId = (created.body as MeetingResponse).id;

      const response = await request(app.getHttpServer())
        .patch(`/meetings/${createdId}`)
        .set(auth(user.token))
        .send({
          title: 'New title',
          date: '2026-09-02T10:00:00.000Z',
          participants: ['alice@example.com', 'bob@example.com'],
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdId,
        title: 'New title',
        participants: ['alice@example.com', 'bob@example.com'],
      });
      expect(
        new Date((response.body as MeetingResponse).date).toISOString(),
      ).toBe('2026-09-02T10:00:00.000Z');
    });

    it('returns 404 when the meeting is not found', async () => {
      const { token } = await registerUser(app);

      await request(app.getHttpServer())
        .patch('/meetings/00000000-0000-0000-0000-000000000000')
        .set(auth(token))
        .send({ title: 'New title' })
        .expect(404);
    });

    it('returns 400 when a field is null', async () => {
      const user = await registerUser(app);
      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send({ title: 'Title', date: meetingDate, participants: [] })
        .expect(201);

      const createdId = (created.body as MeetingResponse).id;

      await request(app.getHttpServer())
        .patch(`/meetings/${createdId}`)
        .set(auth(user.token))
        .send({ title: null })
        .expect(400);
    });

    it('returns 400 when the title is empty', async () => {
      const user = await registerUser(app);
      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send({ title: 'Title', date: meetingDate, participants: [] })
        .expect(201);

      const createdId = (created.body as MeetingResponse).id;

      await request(app.getHttpServer())
        .patch(`/meetings/${createdId}`)
        .set(auth(user.token))
        .send({ title: '' })
        .expect(400);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .patch('/meetings/00000000-0000-0000-0000-000000000000')
        .send({ title: 'New title' })
        .expect(401);
    });
  });
});
