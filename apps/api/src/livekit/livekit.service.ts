import { Inject, Injectable } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import {
  CONFERENCE_TOKEN_TTL_SECONDS,
  LIVEKIT_CONFIG,
} from './livekit.constants';
import type { LiveKitConfig } from './livekit.constants';

export interface ConferenceTokenParticipant {
  userId: string;
  name?: string | null;
  email: string;
}

@Injectable()
export class LiveKitService {
  constructor(@Inject(LIVEKIT_CONFIG) private readonly config: LiveKitConfig) {}

  async createConferenceToken(
    meetingId: string,
    participant: ConferenceTokenParticipant,
  ): Promise<string> {
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: participant.userId,
      name: participant.name ?? undefined,
      metadata: JSON.stringify({
        name: participant.name ?? null,
        email: participant.email,
      }),
      ttl: CONFERENCE_TOKEN_TTL_SECONDS,
    });
    token.addGrant({
      room: meetingId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return token.toJwt();
  }
}
