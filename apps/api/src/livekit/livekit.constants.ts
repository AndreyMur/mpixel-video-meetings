export const LIVEKIT_CONFIG = 'LIVEKIT_CONFIG';

export const DEFAULT_LIVEKIT_URL = 'http://localhost:7880';
export const DEFAULT_LIVEKIT_API_KEY = 'devkey';
export const DEFAULT_LIVEKIT_API_SECRET = 'devsecret';

export const CONFERENCE_TOKEN_TTL_SECONDS = 600;

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}
