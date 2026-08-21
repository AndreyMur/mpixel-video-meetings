import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LIVEKIT_API_KEY,
  DEFAULT_LIVEKIT_API_SECRET,
  DEFAULT_LIVEKIT_URL,
  LIVEKIT_CONFIG,
} from './livekit.constants';
import type { LiveKitConfig } from './livekit.constants';

const LIVEKIT_ENV_KEYS = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
] as const;

const LIVEKIT_CREDENTIAL_KEYS = [
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
] as const;

export const liveKitConfigProvider = {
  provide: LIVEKIT_CONFIG,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): LiveKitConfig => {
    if (isProduction(configService)) {
      assertNoDevelopmentDefaults(configService);
    }
    return {
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
    };
  },
};

function isProduction(configService: ConfigService): boolean {
  return configService.get<string>('NODE_ENV') === 'production';
}

function assertNoDevelopmentDefaults(configService: ConfigService): void {
  const missing = LIVEKIT_ENV_KEYS.filter(
    (key) => !configService.get<string>(key),
  );
  if (missing.length > 0) {
    throw new Error(
      `LiveKit environment variables must be configured in production, development defaults are not allowed. Missing: ${missing.join(', ')}`,
    );
  }

  const defaultCredentials = LIVEKIT_CREDENTIAL_KEYS.filter((key) => {
    const value = configService.get<string>(key);
    return (
      value === DEFAULT_LIVEKIT_API_KEY || value === DEFAULT_LIVEKIT_API_SECRET
    );
  });
  if (defaultCredentials.length > 0) {
    throw new Error(
      `LiveKit development credentials (${DEFAULT_LIVEKIT_API_KEY}/${DEFAULT_LIVEKIT_API_SECRET}) must not be used in production. Reconfigure: ${defaultCredentials.join(', ')}`,
    );
  }
}

function readValue(
  configService: ConfigService,
  key: string,
  fallback: string,
): string {
  const value = configService.get<string>(key);
  return value ? value : fallback;
}
