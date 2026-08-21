import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LIVEKIT_API_KEY,
  DEFAULT_LIVEKIT_API_SECRET,
  DEFAULT_LIVEKIT_URL,
  LIVEKIT_CONFIG,
} from './livekit.constants';
import type { LiveKitConfig } from './livekit.constants';

export const liveKitConfigProvider = {
  provide: LIVEKIT_CONFIG,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): LiveKitConfig => ({
    url: readValue(configService, 'LIVEKIT_URL', DEFAULT_LIVEKIT_URL),
    apiKey: readValue(
      configService,
      'LIVEKIT_API_KEY',
      DEFAULT_LIVEKIT_API_KEY,
    ),
    apiSecret: readValue(
      configService,
      'LIVEKIT_API_SECRET',
      DEFAULT_LIVEKIT_API_SECRET,
    ),
  }),
};

function readValue(
  configService: ConfigService,
  key: string,
  fallback: string,
): string {
  const value = configService.get<string>(key);
  return value ? value : fallback;
}
