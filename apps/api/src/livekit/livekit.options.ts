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
    url: configService.get<string>('LIVEKIT_URL', DEFAULT_LIVEKIT_URL),
    apiKey: configService.get<string>(
      'LIVEKIT_API_KEY',
      DEFAULT_LIVEKIT_API_KEY,
    ),
    apiSecret: configService.get<string>(
      'LIVEKIT_API_SECRET',
      DEFAULT_LIVEKIT_API_SECRET,
    ),
  }),
};
