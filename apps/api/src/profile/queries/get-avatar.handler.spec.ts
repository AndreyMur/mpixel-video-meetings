import { NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetAvatarHandler } from './get-avatar.handler';
import { GetAvatarQuery } from './get-avatar.query';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'user@example.com',
    passwordHash: 'hash',
    name: null,
    avatarObjectKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('GetAvatarHandler', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let handler: GetAvatarHandler;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    handler = new GetAvatarHandler(prisma as unknown as PrismaService);
  });

  it('returns the object key and png mime type', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ avatarObjectKey: 'avatars/u1/a.png' }),
    );

    const result = await handler.execute(new GetAvatarQuery('u1'));

    expect(result).toEqual({
      objectKey: 'avatars/u1/a.png',
      mimeType: 'image/png',
    });
  });

  it('returns image/jpeg for a jpg avatar', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ avatarObjectKey: 'avatars/u1/a.jpg' }),
    );

    const result = await handler.execute(new GetAvatarQuery('u1'));

    expect(result.mimeType).toBe('image/jpeg');
  });

  it('throws NotFoundException when no avatar is set', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());

    await expect(
      handler.execute(new GetAvatarQuery('u1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new GetAvatarQuery('u1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
