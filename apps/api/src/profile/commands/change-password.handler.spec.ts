import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordHandler } from './change-password.handler';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const mockCompare = bcrypt.compare as jest.Mock;
const mockHash = bcrypt.hash as jest.Mock;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'user@example.com',
    passwordHash: 'current-hash',
    name: null,
    avatarObjectKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ChangePasswordHandler', () => {
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let handler: ChangePasswordHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    handler = new ChangePasswordHandler(prisma as unknown as PrismaService);
  });

  it('rejects an incorrect old password and does not change it', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    mockCompare.mockResolvedValue(false);

    await expect(
      handler.execute(
        new ChangePasswordCommand('u1', {
          oldPassword: 'WrongPass1',
          newPassword: 'NewPassword1',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(mockCompare).toHaveBeenCalledWith('WrongPass1', 'current-hash');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('hashes the new password and updates the hash on success', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue('new-hash');

    await handler.execute(
      new ChangePasswordCommand('u1', {
        oldPassword: 'CurrentPass1',
        newPassword: 'NewPassword1',
      }),
    );

    expect(mockHash).toHaveBeenCalledWith('NewPassword1', 10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'new-hash' },
    });
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(
        new ChangePasswordCommand('u1', {
          oldPassword: 'CurrentPass1',
          newPassword: 'NewPassword1',
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
