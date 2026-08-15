export interface AuthResponse {
  accessToken: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  sub: string;
  email: string;
}

export const ACCESS_TOKEN_KEY = 'accessToken';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getSessionUser(): SessionUser | null {
  const token = getAccessToken();
  if (!token) {
    return null;
  }
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64)) as Partial<SessionUser>;
    return decoded.sub && decoded.email
      ? { sub: decoded.sub, email: decoded.email }
      : null;
  } catch {
    return null;
  }
}

interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function parseError(res: Response): Promise<ApiError> {
  const rawBody = await res.text().catch(() => '');
  return parseErrorPayload(res.status, rawBody);
}

export function parseErrorPayload(status: number, rawBody: string): ApiError {
  let body: ApiErrorBody | undefined;
  try {
    body = JSON.parse(rawBody) as ApiErrorBody;
  } catch {
    // fall back to generic message below
  }

  const message = Array.isArray(body?.message)
    ? body.message[0]
    : body?.message;
  const details = Array.isArray(body?.message) ? body.message : undefined;

  return new ApiError(status, message ?? 'Something went wrong', details);
}

export async function register(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as AuthResponse;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as AuthResponse;
}

export async function getMeetings(token: string): Promise<Meeting[]> {
  const res = await fetch('/api/meetings', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as Meeting[];
}

export async function getMeeting(
  meetingId: string,
  token: string,
): Promise<Meeting> {
  const res = await fetch(`/api/meetings/${meetingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as Meeting;
}
