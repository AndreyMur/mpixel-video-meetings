'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowRightFromSquare,
  Calendar,
  Clock,
  Person,
  Plus,
  TriangleExclamation,
  Video,
} from '@gravity-ui/icons';
import { buttonVariants } from '@heroui/styles';
import { Avatar, Button, Card, Chip, Skeleton, Tooltip } from '@heroui/react';
import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  getMeetings,
  getSessionUser,
  type Meeting,
} from '@/lib/auth';
import { fetchAvatarSrc, getProfile, type UserProfile } from '@/lib/profile';

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function formatTime(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <Card variant="secondary" className="w-full">
      <Card.Header className="gap-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Video aria-hidden="true" className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Card.Title className="truncate text-base">
            {meeting.title}
          </Card.Title>
          {meeting.description ? (
            <p className="truncate text-sm text-muted">{meeting.description}</p>
          ) : null}
          <Card.Description className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <Calendar aria-hidden="true" className="size-3.5" />
              {formatDate(meeting.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="size-3.5" />
              {formatTime(meeting.date)}
            </span>
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Footer>
        <Chip size="sm" variant="secondary">
          <Person aria-hidden="true" className="size-3.5" />
          {meeting.participants.length === 1
            ? '1 участник'
            : `${meeting.participants.length} участников`}
        </Chip>
      </Card.Footer>
    </Card>
  );
}

function MeetingCardSkeleton() {
  return (
    <Card variant="secondary" className="w-full">
      <Card.Header className="gap-2">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-2/3 rounded-md" />
          <Skeleton className="h-3 w-1/2 rounded-md" />
        </div>
      </Card.Header>
      <Card.Footer>
        <Skeleton className="h-5 w-24 rounded-full" />
      </Card.Footer>
    </Card>
  );
}

export default function Home() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const avatarUrlRef = useRef<string | null>(null);

  const releaseAvatarUrl = useCallback((url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const setAvatarWithUrl = useCallback(
    (src: string | null) => {
      if (src === avatarUrlRef.current) {
        return;
      }
      releaseAvatarUrl(avatarUrlRef.current);
      avatarUrlRef.current = src;
      setAvatarSrc(src);
    },
    [releaseAvatarUrl],
  );

  useEffect(() => {
    return () => {
      releaseAvatarUrl(avatarUrlRef.current);
      avatarUrlRef.current = null;
    };
  }, [releaseAvatarUrl]);

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    getMeetings(token)
      .then((data) => {
        if (!cancelled) {
          setMeetings(data);
          setError(null);
        }
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
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    getProfile(token)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setProfileError(null);
        }
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
        setProfileError(
          err instanceof Error ? err.message : 'Something went wrong',
        );
      });

    fetchAvatarSrc(token)
      .then((src) => {
        if (!cancelled) {
          setAvatarWithUrl(src);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvatarWithUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, setAvatarWithUrl]);

  const handleLogout = () => {
    clearAccessToken();
    router.replace('/login');
  };

  const displayName = profile?.name || profile?.email || null;

  const headerUserArea = (
    <div className="flex items-center gap-3">
      <Link
        href="/profile"
        aria-label={displayName ? `Профиль: ${displayName}` : 'Профиль'}
        className="flex min-h-11 items-center gap-2 rounded-full p-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Avatar size="sm" className="size-9">
          {avatarSrc ? (
            <Avatar.Image alt="Аватар пользователя" src={avatarSrc} />
          ) : null}
          <Avatar.Fallback>
            <Person className="size-4" />
          </Avatar.Fallback>
        </Avatar>
        {displayName ? (
          <span className="hidden max-w-40 truncate text-sm text-muted sm:block">
            {displayName}
          </span>
        ) : null}
      </Link>
      {profileError ? (
        <Tooltip>
          <Button
            variant="tertiary"
            size="sm"
            isIconOnly
            aria-label={`Не удалось загрузить профиль: ${profileError}`}
          >
            <TriangleExclamation className="size-4 text-danger" />
          </Button>
          <Tooltip.Content>
            <p className="max-w-xs">
              Не удалось загрузить профиль: {profileError}
            </p>
          </Tooltip.Content>
        </Tooltip>
      ) : null}
      <Button variant="tertiary" size="sm" onPress={handleLogout}>
        <ArrowRightFromSquare className="size-4" />
        Выйти
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <main className="flex min-h-dvh flex-col bg-background">
        <header className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <Video className="size-7 text-accent" />
            <span className="text-lg font-semibold tracking-tight">
              MPixel Meeting
            </span>
          </div>
          <Skeleton className="h-9 w-36 rounded-full" />
        </header>
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
          <Skeleton className="h-8 w-48 rounded-md" />
          <div className="grid gap-4 sm:grid-cols-3">
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
          </div>
          <Skeleton className="h-8 w-40 rounded-md" />
          <div className="grid gap-4">
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
          </div>
        </div>
      </main>
    );
  }

  const lastMeetings = meetings.slice(0, 3);

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Video className="size-7 shrink-0 text-accent" />
          <span className="truncate text-lg font-semibold tracking-tight">
            MPixel Meeting
          </span>
        </div>
        {headerUserArea}
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-8 sm:px-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Добро пожаловать{displayName ? `, ${displayName}` : ''}
            </h1>
            <p className="text-sm text-muted">
              Здесь вы найдёте все свои встречи MPixel.
            </p>
          </div>
          <Link
            href="/meetings/new"
            className={buttonVariants({ size: 'md', variant: 'primary' })}
          >
            <Plus className="size-4" />
            Создать встречу
          </Link>
        </section>

        {error ? (
          <Card variant="secondary">
            <Card.Content>
              <p className="text-sm text-danger">
                Не удалось загрузить встречи: {error}
              </p>
            </Card.Content>
          </Card>
        ) : null}

        {lastMeetings.length > 0 ? (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-accent" />
              <h2 className="text-lg font-semibold tracking-tight">
                Последние встречи
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {lastMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/meetings/${meeting.id}`}
                  className="transition-opacity hover:opacity-80"
                >
                  <MeetingCard meeting={meeting} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-accent" />
              <h2 className="text-lg font-semibold tracking-tight">
                {meetings.length > 0 ? 'Все встречи' : 'Встречи'}
              </h2>
            </div>
            <Link
              href="/meetings"
              className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
            >
              Смотреть все
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {meetings.length === 0 ? (
            <Card variant="secondary">
              <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
                <Video className="size-10 text-muted" />
                <p className="text-base font-medium text-foreground">
                  Пока нет ни одной встречи
                </p>
                <p className="max-w-sm text-sm text-muted">
                  Когда вы создадите первую встречу, она появится в этом списке.
                </p>
              </Card.Content>
            </Card>
          ) : (
            <div className="grid gap-4">
              {meetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  href={`/meetings/${meeting.id}`}
                  className="transition-opacity hover:opacity-80"
                >
                  <MeetingCard meeting={meeting} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
