'use client';

import {
  ArrowRightFromSquare,
  Calendar,
  Clock,
  Pencil,
  Person,
  Plus,
  TriangleExclamation,
  TrashBin,
  Video,
} from '@gravity-ui/icons';
import { buttonVariants } from '@heroui/styles';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Skeleton,
  Spinner,
  Tooltip,
} from '@heroui/react';
import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  getMeetings,
  getSessionUser,
  type Meeting,
} from '@/lib/auth';
import { deleteMeeting } from '@/lib/meetings';

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

function MeetingCard({
  meeting,
  isDeleting,
  onDelete,
}: {
  meeting: Meeting;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  return (
    <Card variant="secondary" className="w-full">
      <Card.Header className="gap-2">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Video aria-hidden="true" className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Link
            href={`/meetings/${meeting.id}`}
            className="truncate text-base font-semibold text-foreground hover:text-accent"
            aria-label={`Открыть ${meeting.title}`}
          >
            {meeting.title}
          </Link>
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
      <Card.Footer className="justify-between gap-2">
        <Chip size="sm" variant="secondary">
          <Person aria-hidden="true" className="size-3.5" />
          {meeting.participants.length === 1
            ? '1 участник'
            : `${meeting.participants.length} участников`}
        </Chip>
        <div className="flex items-center gap-1">
          <Tooltip>
            <Link
              href={`/meetings/${meeting.id}/edit`}
              aria-label={`Изменить ${meeting.title}`}
              className={buttonVariants({
                isIconOnly: true,
                size: 'sm',
                variant: 'tertiary',
              })}
            >
              <Pencil className="size-4" />
            </Link>
            <Tooltip.Content>Изменить</Tooltip.Content>
          </Tooltip>
          <AlertDialog>
            <Button
              isIconOnly
              variant="danger-soft"
              size="sm"
              aria-label={`Удалить ${meeting.title}`}
              isDisabled={isDeleting}
            >
              {isDeleting ? (
                <Spinner color="current" size="sm" />
              ) : (
                <TrashBin className="size-4" />
              )}
            </Button>
            <AlertDialog.Backdrop>
              <AlertDialog.Container>
                <AlertDialog.Dialog>
                  <AlertDialog.Header>
                    <AlertDialog.Icon />
                    <AlertDialog.Heading>Удалить встречу?</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    <p>
                      Встреча «{meeting.title}» будет удалена без возможности
                      восстановления.
                    </p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button variant="tertiary" slot="close">
                      Отмена
                    </Button>
                    <Button
                      variant="danger"
                      slot="close"
                      isPending={isDeleting}
                      onPress={onDelete}
                    >
                      Удалить
                    </Button>
                  </AlertDialog.Footer>
                </AlertDialog.Dialog>
              </AlertDialog.Container>
            </AlertDialog.Backdrop>
          </AlertDialog>
        </div>
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

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        if (cancelled) {
          return;
        }
        setEmail(user.email);
        setMeetings(data);
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
  }, [router]);

  const handleDelete = async (meeting: Meeting) => {
    const token = getAccessToken();
    if (!token || deletingId === meeting.id) {
      return;
    }
    setDeletingId(meeting.id);
    setError(null);
    try {
      await deleteMeeting(token, meeting.id);
      setMeetings((prev) => prev.filter((item) => item.id !== meeting.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAccessToken();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    clearAccessToken();
    router.replace('/login');
  };

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-8">
        <Link
          href="/"
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

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Встречи</h1>
          <p className="text-sm text-muted">
            Создавайте и управляйте своими встречами MPixel.
          </p>
        </div>

        <div className="flex justify-end">
          <Link
            href="/meetings/new"
            className={buttonVariants({ size: 'md', variant: 'primary' })}
          >
            <Plus className="size-4" />
            Создать встречу
          </Link>
        </div>

        {error ? (
          <Card variant="secondary">
            <Card.Content>
              <p
                role="alert"
                className="flex items-center gap-2 text-sm text-danger"
              >
                <TriangleExclamation className="size-4 shrink-0" />
                {error}
              </p>
            </Card.Content>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="grid gap-4">
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
            <MeetingCardSkeleton />
          </div>
        ) : meetings.length === 0 ? (
          <Card variant="secondary">
            <Card.Content className="flex flex-col items-center gap-2 py-10 text-center">
              <Video className="size-10 text-muted" />
              <p className="text-base font-medium text-foreground">
                Пока нет ни одной встречи
              </p>
              <p className="max-w-sm text-sm text-muted">
                Создайте первую встречу, чтобы начать собирать участников и
                загружать файлы.
              </p>
            </Card.Content>
          </Card>
        ) : (
          <div className="grid gap-4">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                isDeleting={deletingId === meeting.id}
                onDelete={() => void handleDelete(meeting)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
