import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
  HeadBucketCommand: jest.fn(),
  CreateBucketCommand: jest.fn(),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

const mockSend = jest.fn();
(S3Client as unknown as jest.Mock).mockImplementation(() => ({
  send: mockSend,
}));

function makeConfig(): ConfigService {
  return {
    getOrThrow: (key: string): string => {
      const values: Record<string, string> = {
        S3_BUCKET: 'bucket',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY: 'access',
        S3_SECRET_KEY: 'secret',
      };
      return values[key];
    },
    get: (key: string, fallback?: unknown): unknown =>
      key === 'S3_REGION' ? 'us-east-1' : fallback,
  } as unknown as ConfigService;
}

describe('StorageService.downloadToFile', () => {
  it('writes the object body to the destination file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mpixel-storage-'));
    const destination = join(dir, 'out.bin');
    try {
      mockSend.mockResolvedValue({ Body: Readable.from(['hello']) });

      const service = new StorageService(makeConfig());
      await service.downloadToFile('meetings/m/file-1/x.pdf', destination);

      expect(await readFile(destination, 'utf8')).toBe('hello');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
