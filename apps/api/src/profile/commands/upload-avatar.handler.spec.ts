import type { Express } from 'express';
import type { User } from '@prisma/client';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { verifyImageType } from '../image-detector';
import { UploadAvatarCommand } from './upload-avatar.command';
import { UploadAvatarHandler } from './upload-avatar.handler';

jest.mock('../image-detector', () => ({
  verifyImageType: jest.fn(),
}));

const mockVerify = verifyImageType as jest.Mock;

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

describe('UploadAvatarHandler', () => {
  let tempDir: string;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let storage: { putObject: jest.Mock; deleteObject: jest.Mock };
  let handler: UploadAvatarHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue(true);
    tempDir = await mkdtemp(join(tmpdir(), 'mpixel-avatar-'));
    await writeFile(join(tempDir, 'avatar.png'), 'fake-png-bytes');
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    storage = {
      putObject: jest.fn(async (_key: string, body: unknown) => {
        const stream = body as NodeJS.ReadableStream;
        await new Promise<void>((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
          stream.resume();
        });
      }),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    handler = new UploadAvatarHandler(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeFile(): Express.Multer.File {
    return {
      fieldname: 'file',
      originalname: 'avatar.png',
      encoding: '7bit',
      mimetype: 'image/png',
      destination: '',
      filename: 'x',
      path: join(tempDir, 'avatar.png'),
      size: 128,
    } as Express.Multer.File;
  }

  it('saves the avatar and updates avatarObjectKey', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    prisma.user.update.mockResolvedValue(
      makeUser({ avatarObjectKey: 'avatars/u1/a.png' }),
    );

    const result = await handler.execute(
      new UploadAvatarCommand('u1', makeFile()),
    );

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const updateCall = prisma.user.update.mock.calls[0] as unknown as [
      { where: { id: string }; data: { avatarObjectKey: string } },
    ];
    expect(updateCall[0].where).toEqual({ id: 'u1' });
    expect(updateCall[0].data.avatarObjectKey).toMatch(
      /^avatars\/u1\/.+\.png$/,
    );
    expect(result.avatarUrl).toBe('/users/me/avatar');
  });

  it('rejects a file with an unsupported extension', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    const file = makeFile();
    file.originalname = 'avatar.gif';

    await expect(
      handler.execute(new UploadAvatarCommand('u1', file)),
    ).rejects.toThrow('Неподдерживаемый формат изображения');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects content that does not match the extension', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    mockVerify.mockResolvedValue(false);

    await expect(
      handler.execute(new UploadAvatarCommand('u1', makeFile())),
    ).rejects.toThrow('Содержимое файла не соответствует заявленному формату.');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a missing file', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());

    await expect(
      handler.execute(new UploadAvatarCommand('u1')),
    ).rejects.toThrow('Файл не передан');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(new UploadAvatarCommand('u1', makeFile())),
    ).rejects.toThrow('User not found');
  });

  it('deletes the new object when saving fails', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());
    storage.putObject.mockImplementation(
      async (_key: string, body: unknown) => {
        const stream = body as NodeJS.ReadableStream;
        await new Promise<void>((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
          stream.resume();
        });
        throw new Error('storage down');
      },
    );

    await expect(
      handler.execute(new UploadAvatarCommand('u1', makeFile())),
    ).rejects.toThrow('Не удалось сохранить аватар');

    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
