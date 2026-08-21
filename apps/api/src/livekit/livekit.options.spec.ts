import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_LIVEKIT_API_KEY,
  DEFAULT_LIVEKIT_API_SECRET,
  DEFAULT_LIVEKIT_URL,
} from './livekit.constants';
import { liveKitConfigProvider } from './livekit.options';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string, defaultValue?: string) => values[key] ?? defaultValue,
  } as unknown as ConfigService;
}

describe('liveKitConfigProvider', () => {
  it('reads values from env', () => {
    const config = liveKitConfigProvider.useFactory(
      makeConfig({
        LIVEKIT_URL: 'http://livekit.local:7880',
        LIVEKIT_API_KEY: 'my-key',
        LIVEKIT_API_SECRET: 'my-secret',
      }),
    );
    expect(config).toEqual({
      url: 'http://livekit.local:7880',
      apiKey: 'my-key',
      apiSecret: 'my-secret',
    });
  });

  it('falls back to development defaults when env is missing', () => {
    const config = liveKitConfigProvider.useFactory(makeConfig({}));
    expect(config).toEqual({
      url: DEFAULT_LIVEKIT_URL,
      apiKey: DEFAULT_LIVEKIT_API_KEY,
      apiSecret: DEFAULT_LIVEKIT_API_SECRET,
    });
  });
});
