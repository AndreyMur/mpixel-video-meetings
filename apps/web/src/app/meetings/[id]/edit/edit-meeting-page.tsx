'use client';

import { ArrowLeft, ArrowRightFromSquare, Video } from '@gravity-ui/icons';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, Skeleton } from '@heroui/react';
import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  getMeeting,
  getSessionUser,
  type Meeting,
} from '@/lib/auth';
import { MeetingForm } from '../../meeting-form';

export default function EditMeetingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const meetingId = params.id;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

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
    getMeeting(meetingId, accessToken)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setEmail(user.email);
        setToken(accessToken);
        setMeeting(data);
        setPageError(null);
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
        if (err instanceof ApiError && err.status === 404) {
          setIsNotFound(true);
          return;
        }
        setPageError(
          err instanceof Error ? err.message : 'Something went wrong',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [meetingId, router]);

  const handleLogout = () => {
    clearAccessToken();
    router.replace('/login');
  };

  const header = (
    <header className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-8">
      <Link
        href="/meetings"
        className="flex min-w-0 items-center gap-2 text-foreground"
      >
        <Video className="size-7 shrink-0 text-accent" />
        <span className="truncate text-lg font-semibold tracking-tight">
          MPixel Meeting
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:block">{email}</span>
        <Button variant="tertiary" size="sm" onPress={handleLogout}>
          <ArrowRightFromSquare className="size-4" />
          Выйти
        </Button>
      </div>
    </header>
  );

  if (isLoading) {
    return (
      <main className="flex min-h-dvh flex-col bg-background">
        {header}
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  if (isNotFound) {
    return (
      <main className="flex min-h-dvh flex-col bg-background">
        {header}
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
          <Video className="size-12 text-muted" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Встреча не найдена
          </h1>
          <Button variant="secondary" onPress={() => router.push('/meetings')}>
            <ArrowLeft className="size-4" />К списку встреч
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {header}

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <Link
            href={`/meetings/${meetingId}`}
            className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />К встрече
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Изменить встречу
          </h1>
        </div>

        {pageError ? (
          <Card variant="secondary">
            <Card.Content>
              <p role="alert" className="text-sm text-danger">
                {pageError}
              </p>
            </Card.Content>
          </Card>
        ) : null}

        {meeting && token ? (
          <MeetingForm
            token={token}
            mode="edit"
            meetingId={meetingId}
            initial={meeting}
          />
        ) : null}
      </div>
    </main>
  );
}
