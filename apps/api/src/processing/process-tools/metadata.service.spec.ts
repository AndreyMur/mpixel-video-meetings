import type { MeetingFile } from '@prisma/client';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { runCommand } from './exec';
import { MetadataService } from './metadata.service';
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

describe('MetadataService', () => {
  let service: MetadataService;
  let tools: ProcessToolsService;

  beforeEach(() => {
    jest.clearAllMocks();
    tools = { ffprobe: '/usr/bin/ffprobe' } as ProcessToolsService;
    service = new MetadataService(tools);
  });

  it('extracts media metadata via ffprobe', async () => {
    mockRunCommand.mockResolvedValue({
      stdout: JSON.stringify({
        format: { format_name: 'mov,mp4', duration: '12.5' },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            avg_frame_rate: '30/1',
          },
          {
            codec_type: 'audio',
            codec_name: 'aac',
            sample_rate: '44100',
            channels: 2,
          },
        ],
      }),
      stderr: '',
    });

    const metadata = await service.extract(
      makeFile('clip.mp4'),
      '/tmp/clip.mp4',
    );

    expect(mockRunCommand).toHaveBeenCalledWith(
      '/usr/bin/ffprobe',
      expect.arrayContaining([
        '-show_format',
        '-show_streams',
        '/tmp/clip.mp4',
      ]),
    );
    expect(metadata).toMatchObject({
      format: 'mov,mp4',
      duration: 12.5,
      video: { codec: 'h264', width: 1920, height: 1080, fps: 30 },
      audio: { codec: 'aac', sampleRate: 44100, channels: 2 },
    });
  });

  it('extracts page count for a pdf', async () => {
    const document = await PDFDocument.create();
    document.addPage();
    document.addPage();
    const bytes = await document.save();

    const dir = await mkdtemp(join(tmpdir(), 'mpixel-meta-'));
    try {
      const pdfPath = join(dir, 'doc.pdf');
      await writeFile(pdfPath, bytes);
      const metadata = await service.extract(makeFile('doc.pdf'), pdfPath);
      expect(metadata).toEqual({ format: 'pdf', pages: 2 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns empty metadata for other file types', async () => {
    const metadata = await service.extract(
      makeFile('notes.txt'),
      '/tmp/notes.txt',
    );
    expect(metadata).toEqual({});
  });
});
