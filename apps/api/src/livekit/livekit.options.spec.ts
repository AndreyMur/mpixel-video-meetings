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

  it('falls back to development defaults for empty env values', () => {
    const config = liveKitConfigProvider.useFactory(
      makeConfig({
        LIVEKIT_URL: '',
        LIVEKIT_API_KEY: '',
        LIVEKIT_API_SECRET: '',
      }),
    );
    expect(config).toEqual({
      url: DEFAULT_LIVEKIT_URL,
      apiKey: DEFAULT_LIVEKIT_API_KEY,
      apiSecret: DEFAULT_LIVEKIT_API_SECRET,
    });
  });

  it('allows development defaults outside production', () => {
    const config = liveKitConfigProvider.useFactory(
      makeConfig({ NODE_ENV: 'development' }),
    );
    expect(config).toEqual({
      url: DEFAULT_LIVEKIT_URL,
      apiKey: DEFAULT_LIVEKIT_API_KEY,
      apiSecret: DEFAULT_LIVEKIT_API_SECRET,
    });
  });

  it('throws in production when LiveKit env is missing', () => {
    expect(() =>
      liveKitConfigProvider.useFactory(makeConfig({ NODE_ENV: 'production' })),
    ).toThrow(/LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET/);
  });

  it('throws in production listing only the missing variables', () => {
    expect(() =>
      liveKitConfigProvider.useFactory(
        makeConfig({
          NODE_ENV: 'production',
          LIVEKIT_URL: 'http://livekit.local:7880',
          LIVEKIT_API_SECRET: 'my-secret',
        }),
      ),
    ).toThrow(/Missing: LIVEKIT_API_KEY$/);
  });

  it('throws in production when the development credentials are set explicitly', () => {
    expect(() =>
      liveKitConfigProvider.useFactory(
        makeConfig({
          NODE_ENV: 'production',
          LIVEKIT_URL: 'http://livekit.local:7880',
          LIVEKIT_API_KEY: 'devkey',
          LIVEKIT_API_SECRET: 'devsecret',
        }),
      ),
    ).toThrow(/devkey\/devsecret.*LIVEKIT_API_KEY, LIVEKIT_API_SECRET/);
  });

  it('throws in production when only one credential matches a development default', () => {
    expect(() =>
      liveKitConfigProvider.useFactory(
        makeConfig({
          NODE_ENV: 'production',
          LIVEKIT_URL: 'http://livekit.local:7880',
          LIVEKIT_API_KEY: 'my-key',
          LIVEKIT_API_SECRET: 'devsecret',
        }),
      ),
    ).toThrow(/LIVEKIT_API_SECRET$/);
  });

  it('reads values from env in production', () => {
    const config = liveKitConfigProvider.useFactory(
      makeConfig({
        NODE_ENV: 'production',
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
});
