import { Injectable } from '@nestjs/common';
import type { MeetingFile } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { runCommand } from './exec';
import { MEDIA_EXTENSIONS } from './file-types';
import { ProcessToolsService } from './tools.service';

@Injectable()
export class MetadataService {
  constructor(private readonly tools: ProcessToolsService) {}

  async extract(
    file: MeetingFile,
    filePath: string,
  ): Promise<Record<string, unknown>> {
    const extension = extname(file.name).toLowerCase().slice(1);
    if (MEDIA_EXTENSIONS.has(extension)) {
      return this.mediaMetadata(filePath);
    }
    if (extension === 'pdf') {
      return this.pdfMetadata(filePath);
    }
    return {};
  }

  private async mediaMetadata(
    filePath: string,
  ): Promise<Record<string, unknown>> {
    const { stdout } = await runCommand(this.tools.ffprobe, [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    const info = JSON.parse(stdout) as {
      format?: Record<string, string>;
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        avg_frame_rate?: string;
        sample_rate?: string;
        channels?: number;
      }>;
    };
    const format = info.format ?? {};
    const video = info.streams?.find((s) => s.codec_type === 'video');
    const audio = info.streams?.find((s) => s.codec_type === 'audio');

    const metadata: Record<string, unknown> = {
      format: format.format_name ?? null,
      duration: format.duration ? Number(format.duration) : null,
    };
    if (video) {
      metadata.video = {
        codec: video.codec_name ?? null,
        width: video.width ?? null,
        height: video.height ?? null,
        fps: video.avg_frame_rate ? parseFps(video.avg_frame_rate) : null,
      };
    }
    if (audio) {
      metadata.audio = {
        codec: audio.codec_name ?? null,
        sampleRate: audio.sample_rate ? Number(audio.sample_rate) : null,
        channels: audio.channels ?? null,
      };
    }
    return metadata;
  }

  private async pdfMetadata(
    filePath: string,
  ): Promise<Record<string, unknown>> {
    const data = await readFile(filePath);
    const document = await PDFDocument.load(data, { ignoreEncryption: true });
    return { format: 'pdf', pages: document.getPageCount() };
  }
}

function parseFps(value: string): number | null {
  const parts = value.split('/');
  if (parts.length !== 2) {
    return null;
  }
  const numerator = Number(parts[0]);
  const denominator = Number(parts[1]);
  if (!denominator) {
    return null;
  }
  return Math.round((numerator / denominator) * 100) / 100;
}
