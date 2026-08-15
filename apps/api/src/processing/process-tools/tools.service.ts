import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpegStatic from 'ffmpeg-static';
import { path as ffprobeStaticPath } from 'ffprobe-static';

@Injectable()
export class ProcessToolsService {
  constructor(private readonly config: ConfigService) {}

  get ffmpeg(): string {
    return (
      this.config.get<string>('FFMPEG_BIN')?.trim() || ffmpegStatic || 'ffmpeg'
    );
  }

  get ffprobe(): string {
    return (
      this.config.get<string>('FFPROBE_BIN')?.trim() ||
      ffprobeStaticPath ||
      'ffprobe'
    );
  }
}
