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
  description?: string;
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
        description: 'Quarterly goals',
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
        description: body.description,
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

    it('returns 400 when the date is missing', async () => {
      const { token } = await registerUser(app);

      await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(token))
        .send({ title: 'No date', participants: [] })
        .expect(400);
    });

    it('returns 400 when a participant email is invalid', async () => {
      const { token } = await registerUser(app);

      await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(token))
        .send({
          title: 'Bad email',
          date: meetingDate,
          participants: ['not-an-email'],
        })
        .expect(400);
    });

    it('creates a meeting without participants and description', async () => {
      const { token } = await registerUser(app);

      const response = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(token))
        .send({ title: 'Solo', date: meetingDate })
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'Solo',
        participants: [],
        description: null,
      });
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
    async function createOwnedMeeting(token: string): Promise<string> {
      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(token))
        .send({ title: 'To update', date: meetingDate, participants: [] })
        .expect(201);
      return (created.body as MeetingResponse).id;
    }

    it('updates the own meeting fields', async () => {
      const user = await registerUser(app);
      const meetingId = await createOwnedMeeting(user.token);

      const response = await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .send({
          title: 'Updated title',
          description: 'Updated description',
          date: '2026-09-03T10:00:00.000Z',
          participants: ['carol@example.com'],
        })
        .expect(200);

      expect(response.body).toMatchObject({
        id: meetingId,
        title: 'Updated title',
        description: 'Updated description',
        participants: ['carol@example.com'],
      });
      expect(
        new Date((response.body as MeetingResponse).date).toISOString(),
      ).toBe('2026-09-03T10:00:00.000Z');
    });

    it('updates a single provided field', async () => {
      const user = await registerUser(app);
      const meetingId = await createOwnedMeeting(user.token);

      const response = await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .send({ title: 'Renamed' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: meetingId,
        title: 'Renamed',
      });
    });

    it('ignores null values for non-nullable fields', async () => {
      const user = await registerUser(app);
      const meetingId = await createOwnedMeeting(user.token);

      const response = await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .send({ title: null, date: null, participants: null })
        .expect(200);

      expect(response.body).toMatchObject({
        id: meetingId,
        title: 'To update',
      });
      expect(
        new Date((response.body as MeetingResponse).date).toISOString(),
      ).toBe(meetingDate);
    });

    it('clears description with an explicit null', async () => {
      const user = await registerUser(app);
      const meetingId = await createOwnedMeeting(user.token);

      await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .send({ description: 'Temporary' })
        .expect(200);

      const cleared = await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .send({ description: null })
        .expect(200);

      expect((cleared.body as MeetingResponse).description).toBeNull();
    });

    it('returns 400 when the title is empty', async () => {
      const user = await registerUser(app);
      const meetingId = await createOwnedMeeting(user.token);

      await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .send({ title: '' })
        .expect(400);
    });

    it('returns 400 for an invalid email in participants', async () => {
      const user = await registerUser(app);
      const meetingId = await createOwnedMeeting(user.token);

      await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .send({ participants: ['bad-email'] })
        .expect(400);
    });

    it('returns 404 when the meeting does not belong to the user', async () => {
      const owner = await registerUser(app);
      const observer = await registerUser(app);
      const meetingId = await createOwnedMeeting(owner.token);

      await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(observer.token))
        .send({ title: 'Hijack' })
        .expect(404);
    });

    it('returns 404 when the meeting is not found', async () => {
      const { token } = await registerUser(app);

      await request(app.getHttpServer())
        .patch('/meetings/00000000-0000-0000-0000-000000000000')
        .set(auth(token))
        .send({ title: 'New title' })
        .expect(404);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .patch('/meetings/00000000-0000-0000-0000-000000000000')
        .send({ title: 'X' })
        .expect(401);
    });
  });

  describe('DELETE /meetings/:id', () => {
    it('deletes the own meeting without files', async () => {
      const user = await registerUser(app);
      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send({ title: 'To delete', date: meetingDate, participants: [] })
        .expect(201);
      const meetingId = (created.body as MeetingResponse).id;

      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .expect(204);

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .expect(404);
    });

    it('returns 409 and keeps the meeting when it has files', async () => {
      const user = await registerUser(app);
      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send({ title: 'With files', date: meetingDate, participants: [] })
        .expect(201);
      const meetingId = (created.body as MeetingResponse).id;

      await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(user.token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .expect(409);

      expect((response.body as { message: string }).message).toContain('files');

      const stillThere = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .expect(200);
      expect((stillThere.body as MeetingResponse).title).toBe('With files');
    });

    it('returns 404 for a foreign or nonexistent meeting', async () => {
      const owner = await registerUser(app);
      const observer = await registerUser(app);
      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(owner.token))
        .send({ title: 'Private', date: meetingDate, participants: [] })
        .expect(201);
      const meetingId = (created.body as MeetingResponse).id;

      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}`)
        .set(auth(observer.token))
        .expect(404);

      await request(app.getHttpServer())
        .delete('/meetings/00000000-0000-0000-0000-000000000000')
        .set(auth(observer.token))
        .expect(404);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer())
        .delete('/meetings/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });

  describe('Invited user access', () => {
    it('grants access by email from participants and shows the meeting in the list', async () => {
      const owner = await registerUser(app);
      const invited = await registerUser(app);

      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(owner.token))
        .send({
          title: 'Shared meeting',
          date: meetingDate,
          participants: [invited.email],
        })
        .expect(201);
      const meetingId = (created.body as MeetingResponse).id;

      const opened = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}`)
        .set(auth(invited.token))
        .expect(200);
      expect((opened.body as MeetingResponse).title).toBe('Shared meeting');

      const list = await request(app.getHttpServer())
        .get('/meetings')
        .set(auth(invited.token))
        .expect(200);
      expect(
        (list.body as MeetingResponse[]).map((meeting) => meeting.id),
      ).toContain(meetingId);
    });

    it('grants an invited user access to the meeting files', async () => {
      const owner = await registerUser(app);
      const invited = await registerUser(app);

      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(owner.token))
        .send({
          title: 'With files',
          date: meetingDate,
          participants: [invited.email],
        })
        .expect(201);
      const meetingId = (created.body as MeetingResponse).id;

      const uploaded = await request(app.getHttpServer())
        .post(`/meetings/${meetingId}/files`)
        .set(auth(owner.token))
        .attach('file', Buffer.from('%PDF-1.4 test content'), {
          filename: 'notes.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      const fileId = (uploaded.body as { id: string }).id;

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}`)
        .set(auth(invited.token))
        .expect(200);

      const files = await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files`)
        .set(auth(invited.token))
        .expect(200);
      expect((files.body as { id: string }[]).map((file) => file.id)).toContain(
        fileId,
      );

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}/files/${fileId}/download`)
        .set(auth(invited.token))
        .expect(200);
    });

    it('returns 404 for a user whose email is not in participants', async () => {
      const owner = await registerUser(app);
      const stranger = await registerUser(app);

      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(owner.token))
        .send({ title: 'Private', date: meetingDate, participants: [] })
        .expect(201);
      const meetingId = (created.body as MeetingResponse).id;

      await request(app.getHttpServer())
        .get(`/meetings/${meetingId}`)
        .set(auth(stranger.token))
        .expect(404);
    });
  });

  describe('Full CRUD cycle', () => {
    it('create → update → delete for a single user', async () => {
      const user = await registerUser(app);

      const created = await request(app.getHttpServer())
        .post('/meetings')
        .set(auth(user.token))
        .send({
          title: 'Cycle',
          description: 'Before',
          date: meetingDate,
          participants: [],
        })
        .expect(201);
      const meetingId = (created.body as MeetingResponse).id;

      const updated = await request(app.getHttpServer())
        .patch(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .send({ title: 'Cycle updated', description: 'After' })
        .expect(200);
      expect(updated.body).toMatchObject({
        id: meetingId,
        title: 'Cycle updated',
        description: 'After',
      });

      const list = await request(app.getHttpServer())
        .get('/meetings')
        .set(auth(user.token))
        .expect(200);
      expect((list.body as MeetingResponse[]).map((m) => m.id)).toContain(
        meetingId,
      );

      await request(app.getHttpServer())
        .delete(`/meetings/${meetingId}`)
        .set(auth(user.token))
        .expect(204);

      const after = await request(app.getHttpServer())
        .get('/meetings')
        .set(auth(user.token))
        .expect(200);
      expect((after.body as MeetingResponse[]).map((m) => m.id)).not.toContain(
        meetingId,
      );
    });
  });
});
