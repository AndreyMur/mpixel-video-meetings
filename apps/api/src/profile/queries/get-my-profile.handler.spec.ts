import { NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMyProfileQuery } from './get-my-profile.query';
import { GetMyProfileHandler } from './get-my-profile.handler';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'user@example.com',
    passwordHash: 'hash',
    name: 'Alice',
    avatarObjectKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('GetMyProfileHandler', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let handler: GetMyProfileHandler;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    handler = new GetMyProfileHandler(prisma as unknown as PrismaService);
  });

  it('returns email, name and a null avatarUrl when there is no avatar', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());

    const result = await handler.execute(new GetMyProfileQuery('u1'));

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });
    expect(result).toEqual({
      email: 'user@example.com',
      name: 'Alice',
      avatarUrl: null,
    });
  });

  it('returns the avatarUrl when the user has an avatar', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ avatarObjectKey: 'avatars/u1/a.png' }),
    );

    const result = await handler.execute(new GetMyProfileQuery('u1'));

    expect(result.avatarUrl).toBe('/users/me/avatar');
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new GetMyProfileQuery('u1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
