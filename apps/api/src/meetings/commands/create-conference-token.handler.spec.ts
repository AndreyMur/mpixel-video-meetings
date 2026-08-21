import { NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { Meeting } from '@prisma/client';
import { LiveKitService } from '../../livekit/livekit.service';
import { FindUserByIdQuery } from '../../users/queries/find-user-by-id.query';
import { GetMeetingQuery } from '../queries/get-meeting.query';
import { CreateConferenceTokenHandler } from './create-conference-token.handler';
import { CreateConferenceTokenCommand } from './create-conference-token.command';

function makeMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: 'm1',
    title: 'Design review',
    description: null,
    date: new Date('2026-09-01T10:00:00Z'),
    participants: ['alice@example.com'],
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('CreateConferenceTokenHandler', () => {
  let queryBus: { execute: jest.Mock };
  let liveKitService: { createConferenceToken: jest.Mock };
  let handler: CreateConferenceTokenHandler;

  beforeEach(() => {
    queryBus = { execute: jest.fn() };
    liveKitService = {
      createConferenceToken: jest.fn().mockResolvedValue('livekit-jwt'),
    };
    handler = new CreateConferenceTokenHandler(
      queryBus as unknown as QueryBus,
      liveKitService as unknown as LiveKitService,
    );
  });

  it('returns a token for the creator', async () => {
    queryBus.execute
      .mockResolvedValueOnce(makeMeeting())
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'alice@example.com',
        name: 'Alice',
      });

    const result = await handler.execute(
      new CreateConferenceTokenCommand('u1', 'alice@example.com', 'm1'),
    );

    expect(result).toEqual({ token: 'livekit-jwt' });
    expect(queryBus.execute).toHaveBeenCalledWith(
      new GetMeetingQuery('u1', 'm1', 'alice@example.com'),
    );
    expect(liveKitService.createConferenceToken).toHaveBeenCalledWith('m1', {
      userId: 'u1',
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('returns a token for a user with MeetingAccess', async () => {
    queryBus.execute
      .mockResolvedValueOnce(makeMeeting({ userId: 'u1' }))
      .mockResolvedValueOnce({
        id: 'u2',
        email: 'bob@example.com',
        name: null,
      });

    const result = await handler.execute(
      new CreateConferenceTokenCommand('u2', 'bob@example.com', 'm1'),
    );

    expect(result).toEqual({ token: 'livekit-jwt' });
    expect(queryBus.execute).toHaveBeenCalledWith(
      new GetMeetingQuery('u2', 'm1', 'bob@example.com'),
    );
    expect(liveKitService.createConferenceToken).toHaveBeenCalledWith('m1', {
      userId: 'u2',
      name: null,
      email: 'bob@example.com',
    });
  });

  it('falls back to the command email when the user record is missing', async () => {
    queryBus.execute
      .mockResolvedValueOnce(makeMeeting())
      .mockResolvedValueOnce(null);

    await handler.execute(
      new CreateConferenceTokenCommand('u1', 'alice@example.com', 'm1'),
    );

    expect(queryBus.execute).toHaveBeenCalledWith(new FindUserByIdQuery('u1'));
    expect(liveKitService.createConferenceToken).toHaveBeenCalledWith('m1', {
      userId: 'u1',
      name: null,
      email: 'alice@example.com',
    });
  });

  it('rejects a stranger without issuing a token', async () => {
    queryBus.execute.mockRejectedValueOnce(
      new NotFoundException('Meeting not found'),
    );

    await expect(
      handler.execute(
        new CreateConferenceTokenCommand('u3', 'mallory@example.com', 'm1'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(liveKitService.createConferenceToken).not.toHaveBeenCalled();
  });
});
