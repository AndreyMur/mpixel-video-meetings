import { NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { DeleteAvatarCommand } from './delete-avatar.command';
import { DeleteAvatarHandler } from './delete-avatar.handler';

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

describe('DeleteAvatarHandler', () => {
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let storage: { deleteObject: jest.Mock };
  let handler: DeleteAvatarHandler;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    storage = { deleteObject: jest.fn().mockResolvedValue(undefined) };
    handler = new DeleteAvatarHandler(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  it('deletes the object and clears avatarObjectKey', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ avatarObjectKey: 'avatars/u1/a.png' }),
    );
    prisma.user.update.mockResolvedValue(makeUser());

    await handler.execute(new DeleteAvatarCommand('u1'));

    expect(storage.deleteObject).toHaveBeenCalledWith('avatars/u1/a.png');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { avatarObjectKey: null },
    });
  });

  it('is a no-op when no avatar is set', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());

    await handler.execute(new DeleteAvatarCommand('u1'));

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteAvatarCommand('u1')),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});
