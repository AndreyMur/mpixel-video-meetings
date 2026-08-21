export const LIVEKIT_CONFIG = 'LIVEKIT_CONFIG';

export const DEFAULT_LIVEKIT_URL = 'http://localhost:7880';
export const DEFAULT_LIVEKIT_API_KEY = 'devkey';
export const DEFAULT_LIVEKIT_API_SECRET = 'devsecret';

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}
