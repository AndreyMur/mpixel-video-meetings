import { TokenVerifier } from 'livekit-server-sdk';
import {
  CONFERENCE_TOKEN_TTL_SECONDS,
  DEFAULT_LIVEKIT_API_KEY,
  DEFAULT_LIVEKIT_API_SECRET,
} from './livekit.constants';
import { LiveKitService } from './livekit.service';

const config = {
  url: 'http://localhost:7880',
  apiKey: DEFAULT_LIVEKIT_API_KEY,
  apiSecret: DEFAULT_LIVEKIT_API_SECRET,
};

describe('LiveKitService', () => {
  let service: LiveKitService;
  let verifier: TokenVerifier;

  beforeEach(() => {
    service = new LiveKitService(config);
    verifier = new TokenVerifier(config.apiKey, config.apiSecret);
  });

  it('issues a valid join token bound to the meeting room', async () => {
    const token = await service.createConferenceToken('meeting-1', {
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
    });

    const claims = await verifier.verify(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.video?.room).toBe('meeting-1');
    expect(claims.video?.roomJoin).toBe(true);
    expect(claims.video?.canPublish).toBe(true);
    expect(claims.video?.canSubscribe).toBe(true);
    expect(claims.video?.canPublishData).toBe(true);
  });

  it('carries participant name and email in metadata', async () => {
    const token = await service.createConferenceToken('meeting-1', {
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
    });

    const claims = await verifier.verify(token);
    expect(JSON.parse(claims.metadata ?? '{}')).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(claims.name).toBe('Alice');
  });

  it('keeps null name in metadata when the user has no name', async () => {
    const token = await service.createConferenceToken('meeting-1', {
      userId: 'user-1',
      name: null,
      email: 'alice@example.com',
    });

    const claims = await verifier.verify(token);
    expect(JSON.parse(claims.metadata ?? '{}')).toEqual({
      name: null,
      email: 'alice@example.com',
    });
  });

  it('uses a short TTL', async () => {
    const token = await service.createConferenceToken('meeting-1', {
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
    });

    const claims = await verifier.verify(token);
    const lifetime = (claims.exp ?? 0) - (claims.nbf ?? 0);
    expect(lifetime).toBe(CONFERENCE_TOKEN_TTL_SECONDS);
    expect(CONFERENCE_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(15 * 60);
  });
});
