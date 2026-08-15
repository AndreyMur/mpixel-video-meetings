import type { MeetingFile } from '@prisma/client';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StorageService } from '../../storage/storage.service';
import { runCommand } from './exec';
import { PreviewService } from './preview.service';
import { ProcessToolsService } from './tools.service';

jest.mock('./exec', () => ({
  runCommand: jest.fn(),
}));

const mockRunCommand = runCommand as jest.Mock;

function makeFile(name: string): MeetingFile {
  return {
    id: 'file-1',
    name,
    mimeType: 'application/octet-stream',
    size: 10,
    status: 'PROCESSING',
    objectKey: 'meetings/m/file-1/x.pdf',
    metadata: null,
    previewObjectKey: null,
    transcriptObjectKey: null,
    errorMessage: null,
    meetingId: 'm',
    userId: 'u',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('PreviewService', () => {
  let service: PreviewService;
  let tools: ProcessToolsService;
  let storage: { putObject: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    tools = {
      ffmpeg: '/usr/bin/ffmpeg',
      ffprobe: '/usr/bin/ffprobe',
    } as ProcessToolsService;
    storage = { putObject: jest.fn() };
    service = new PreviewService(tools, storage as unknown as StorageService);
  });

  it('generates a video preview frame via ffmpeg', async () => {
    mockRunCommand
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ format: { duration: '10' } }),
        stderr: '',
      })
      .mockResolvedValueOnce({ stdout: '', stderr: '' });

    const dir = await mkdtemp(join(tmpdir(), 'mpixel-prev-'));
    try {
      const sourcePath = join(dir, 'clip.mp4');
      await writeFile(sourcePath, 'fake-video-bytes');
      await writeFile(join(dir, 'video-preview.png'), 'preview-bytes');
      const key = await service.generate(makeFile('clip.mp4'), sourcePath, dir);

      expect(mockRunCommand).toHaveBeenCalledWith(
        '/usr/bin/ffmpeg',
        expect.arrayContaining(['-ss', '1', '-i', sourcePath]),
      );
      expect(storage.putObject).toHaveBeenCalledTimes(1);
      expect(key).toBe('meetings/m/file-1/x.pdf.preview.png');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('renders a pdf preview via pdf-to-img', async () => {
    const images = [Buffer.from('page-1-image')];
    const mockPdf = jest.fn().mockResolvedValue({
      [Symbol.asyncIterator]: function* () {
        for (const image of images) {
          yield image;
        }
      },
      destroy: jest.fn(),
    });
    jest
      .spyOn(
        service as unknown as {
          loadPdfToImage: () => Promise<{ pdf: jest.Mock }>;
        },
        'loadPdfToImage',
      )
      .mockResolvedValue({ pdf: mockPdf });

    const dir = await mkdtemp(join(tmpdir(), 'mpixel-prev-'));
    try {
      const sourcePath = join(dir, 'doc.pdf');
      await writeFile(sourcePath, '%PDF-fake');
      const key = await service.generate(makeFile('doc.pdf'), sourcePath, dir);

      expect(mockPdf).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ scale: 1.5 }),
      );
      expect(key).toBe('meetings/m/file-1/x.pdf.preview.png');
      expect(storage.putObject).toHaveBeenCalledTimes(1);
      expect(storage.putObject).toHaveBeenCalledWith(
        'meetings/m/file-1/x.pdf.preview.png',
        expect.anything(),
        'image/png',
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns undefined and uploads nothing for audio files', async () => {
    mockRunCommand.mockResolvedValue({ stdout: '', stderr: '' });

    const dir = await mkdtemp(join(tmpdir(), 'mpixel-prev-'));
    try {
      const sourcePath = join(dir, 'audio.mp3');
      await writeFile(sourcePath, 'fake-audio-bytes');
      const key = await service.generate(
        makeFile('audio.mp3'),
        sourcePath,
        dir,
      );

      expect(key).toBeUndefined();
      expect(storage.putObject).not.toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns undefined and uploads nothing for txt files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mpixel-prev-'));
    try {
      const sourcePath = join(dir, 'notes.txt');
      await writeFile(sourcePath, 'hello');
      const key = await service.generate(
        makeFile('notes.txt'),
        sourcePath,
        dir,
      );

      expect(key).toBeUndefined();
      expect(storage.putObject).not.toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
