import { Injectable } from '@nestjs/common';
import type { MeetingFile } from '@prisma/client';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { StorageService } from '../../storage/storage.service';
import { runCommand } from './exec';
import { ProcessToolsService } from './tools.service';

interface PdfToImageModule {
  pdf: (
    data: Uint8Array,
    options?: { scale?: number },
  ) => Promise<{
    [Symbol.asyncIterator](): AsyncIterator<Uint8Array>;
    destroy(): Promise<void>;
  }>;
}

@Injectable()
export class PreviewService {
  constructor(
    private readonly tools: ProcessToolsService,
    private readonly storage: StorageService,
  ) {}

  async generate(
    file: MeetingFile,
    sourcePath: string,
    workDir: string,
  ): Promise<string | undefined> {
    const extension = extname(file.name).toLowerCase().slice(1);
    let pngPath: string | undefined;
    if (extension === 'mp4' || extension === 'webm') {
      pngPath = await this.videoPreview(sourcePath, workDir);
    } else if (extension === 'pdf') {
      pngPath = await this.renderPdf(sourcePath, workDir);
    }
    if (!pngPath) {
      return undefined;
    }

    const previewKey = `${file.objectKey}.preview.png`;
    await this.storage.putObject(
      previewKey,
      createReadStream(pngPath),
      'image/png',
    );
    return previewKey;
  }

  private async videoPreview(
    sourcePath: string,
    workDir: string,
  ): Promise<string | undefined> {
    const duration = await this.probeDuration(sourcePath);
    const seek = duration ? Math.max(0.1, duration * 0.1) : 1;
    const output = join(workDir, 'video-preview.png');
    await runCommand(this.tools.ffmpeg, [
      '-y',
      '-ss',
      String(seek),
      '-i',
      sourcePath,
      '-frames:v',
      '1',
      '-vf',
      'scale=600:-2',
      '-f',
      'image2',
      output,
    ]);
    return existsSync(output) ? output : undefined;
  }

  private async renderPdf(
    pdfPath: string,
    workDir: string,
  ): Promise<string | undefined> {
    const pdfToImage = await this.loadPdfToImage();
    const data = await readFile(pdfPath);
    const document = await pdfToImage.pdf(data, { scale: 1.5 });
    try {
      for await (const image of document) {
        const output = join(workDir, 'pdf-preview.png');
        await writeFile(output, image);
        return output;
      }
    } finally {
      await document.destroy();
    }
    return undefined;
  }

  private readonly loadPdfToImage = (): Promise<PdfToImageModule> =>
    import('pdf-to-img');

  private async probeDuration(filePath: string): Promise<number | undefined> {
    const { stdout } = await runCommand(this.tools.ffprobe, [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_entries',
      'format=duration',
      filePath,
    ]);
    const info = JSON.parse(stdout) as { format?: { duration?: string } };
    const duration = info.format?.duration;
    return duration ? Number(duration) : undefined;
  }
}
