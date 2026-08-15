import { ConfigService } from '@nestjs/config';
import { processingOptionsProvider } from './processing.options';

function makeConfig(values: Record<string, unknown>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('processingOptionsProvider', () => {
  it('parses numeric env values', () => {
    const options = processingOptionsProvider.useFactory(
      makeConfig({ WORKER_ATTEMPTS: '5', WORKER_BACKOFF_MS: '1000' }),
    );
    expect(options).toEqual({ attempts: 5, backoffDelay: 1000 });
  });

  it('falls back to defaults when env is missing', () => {
    const options = processingOptionsProvider.useFactory(makeConfig({}));
    expect(options).toEqual({ attempts: 3, backoffDelay: 5000 });
  });

  it('falls back to defaults for invalid values', () => {
    const options = processingOptionsProvider.useFactory(
      makeConfig({ WORKER_ATTEMPTS: 'three', WORKER_BACKOFF_MS: '-10' }),
    );
    expect(options).toEqual({ attempts: 3, backoffDelay: 5000 });
  });
});
