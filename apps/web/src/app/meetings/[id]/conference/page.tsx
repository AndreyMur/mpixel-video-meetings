'use client';

import { ArrowLeft, TriangleExclamation, Video } from '@gravity-ui/icons';
import { Button, Card, Spinner } from '@heroui/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  getSessionUser,
} from '@/lib/auth';
import { getConferenceToken } from '@/lib/conference';
import { ConferenceRoom } from './conference-room';

export default function ConferencePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const meetingId = params.id;

  const [activeMeetingId, setActiveMeetingId] = useState<string | undefined>(
    meetingId,
  );
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  if (activeMeetingId !== meetingId) {
    setActiveMeetingId(meetingId);
    setToken(null);
    setIsLoading(true);
    setIsUnavailable(false);
    setError(null);
    setReloadKey(0);
  }

  useEffect(() => {
    if (!meetingId) {
      return;
    }
    const user = getSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    const accessToken = getAccessToken();
    if (!accessToken) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    getConferenceToken(accessToken, meetingId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setToken(response.token);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          clearAccessToken();
          router.replace('/login');
          return;
        }
        if (
          err instanceof ApiError &&
          (err.status === 403 || err.status === 404)
        ) {
          setIsUnavailable(true);
          return;
        }
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meetingId, reloadKey, router]);

  if (isLoading) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
        <Spinner size="lg" />
        <p className="text-sm text-muted">Подключение к конференции…</p>
      </main>
    );
  }

  if (isUnavailable) {
    return (
      <main className="flex min-h-dvh flex-col bg-background">
        <header className="flex items-center gap-2 border-b border-border/60 px-4 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <Video className="size-7 shrink-0 text-accent" />
            <span className="text-lg font-semibold tracking-tight">
              MPixel Meeting
            </span>
          </Link>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
          <Video className="size-12 text-muted" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Конференция недоступна
          </h1>
          <p className="max-w-sm text-sm text-muted">
            Встреча не существует или у вас нет доступа к её конференции.
          </p>
          <Button
            variant="secondary"
            onPress={() => router.push(`/meetings/${meetingId}`)}
          >
            <ArrowLeft className="size-4" />К встрече
          </Button>
        </div>
      </main>
    );
  }

  if (!token || error) {
    return (
      <main className="flex min-h-dvh flex-col bg-background">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
          <Card variant="secondary" className="w-full">
            <Card.Content>
              <p
                role="alert"
                className="flex items-center gap-2 text-sm text-danger"
              >
                <TriangleExclamation className="size-4 shrink-0" />
                {error ?? 'Не удалось получить токен конференции'}
              </p>
            </Card.Content>
          </Card>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onPress={() => setReloadKey((key) => key + 1)}
            >
              Повторить
            </Button>
            <Button
              variant="tertiary"
              onPress={() => router.push(`/meetings/${meetingId}`)}
            >
              <ArrowLeft className="size-4" />К встрече
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <ConferenceRoom
      token={token}
      onLeave={() => router.push(`/meetings/${meetingId}`)}
    />
  );
}
