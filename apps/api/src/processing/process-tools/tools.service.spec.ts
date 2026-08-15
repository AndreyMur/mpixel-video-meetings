import { ConfigService } from '@nestjs/config';
import ffmpegStatic from 'ffmpeg-static';
import { path as ffprobeStaticPath } from 'ffprobe-static';
import { ProcessToolsService } from './tools.service';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('ProcessToolsService', () => {
  it('falls back to static binaries when env is missing', () => {
    const service = new ProcessToolsService(makeConfig({}));
    expect(service.ffmpeg).toBe(ffmpegStatic);
    expect(service.ffprobe).toBe(ffprobeStaticPath);
  });

  it('falls back to static binaries when env is empty or whitespace', () => {
    const service = new ProcessToolsService(
      makeConfig({ FFMPEG_BIN: '', FFPROBE_BIN: '   ' }),
    );
    expect(service.ffmpeg).toBe(ffmpegStatic);
    expect(service.ffprobe).toBe(ffprobeStaticPath);
  });

  it('prefers configured binaries', () => {
    const service = new ProcessToolsService(
      makeConfig({ FFMPEG_BIN: '/opt/ffmpeg', FFPROBE_BIN: '/opt/ffprobe' }),
    );
    expect(service.ffmpeg).toBe('/opt/ffmpeg');
    expect(service.ffprobe).toBe('/opt/ffprobe');
  });
});
