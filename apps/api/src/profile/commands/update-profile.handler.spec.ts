import { NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateProfileCommand } from './update-profile.command';
import { UpdateProfileHandler } from './update-profile.handler';

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

describe('UpdateProfileHandler', () => {
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let handler: UpdateProfileHandler;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    handler = new UpdateProfileHandler(prisma as unknown as PrismaService);
  });

  it('updates the display name', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.update.mockResolvedValue(makeUser({ name: 'Alice' }));

    const result = await handler.execute(
      new UpdateProfileCommand('u1', { name: 'Alice' }),
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: 'Alice' },
    });
    expect(result).toEqual({
      email: 'user@example.com',
      name: 'Alice',
      avatarUrl: null,
    });
  });

  it('clears the name when the value is empty', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.update.mockResolvedValue(makeUser({ name: null }));

    const result = await handler.execute(
      new UpdateProfileCommand('u1', { name: '' }),
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: null },
    });
    expect(result.name).toBeNull();
  });

  it('clears the name when the value is whitespace only', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.update.mockResolvedValue(makeUser({ name: null }));

    await handler.execute(new UpdateProfileCommand('u1', { name: '   ' }));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: null },
    });
  });

  it('trims surrounding whitespace from the name', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.update.mockResolvedValue(makeUser({ name: 'Alice' }));

    await handler.execute(
      new UpdateProfileCommand('u1', { name: '  Alice  ' }),
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: 'Alice' },
    });
  });

  it('leaves the name unchanged when it is not provided', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.update.mockResolvedValue(makeUser({ name: 'Bob' }));

    await handler.execute(new UpdateProfileCommand('u1', {}));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { name: undefined },
    });
  });

  it('returns the avatarUrl when the user has an avatar', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.update.mockResolvedValue(
      makeUser({ name: 'Alice', avatarObjectKey: 'avatars/u1/a.png' }),
    );

    const result = await handler.execute(
      new UpdateProfileCommand('u1', { name: 'Alice' }),
    );

    expect(result.avatarUrl).toBe('/users/me/avatar');
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateProfileCommand('u1', { name: 'Alice' })),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
