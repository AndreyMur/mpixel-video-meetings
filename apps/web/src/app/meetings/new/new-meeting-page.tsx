'use client';

import { ArrowLeft, Video } from '@gravity-ui/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@heroui/react';
import { getAccessToken, getSessionUser } from '@/lib/auth';
import { HeaderUserArea } from '@/components/header-user-area';
import { MeetingForm } from '../meeting-form';

export default function NewMeetingPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
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
    void Promise.resolve().then(() => {
      setEmail(user.email);
      setToken(accessToken);
    });
  }, [router]);

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
      <HeaderUserArea />
    </header>
  );

  if (!token) {
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

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {header}

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/meetings"
            className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />К списку встреч
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Создать встречу
          </h1>
        </div>

        <MeetingForm
          token={token}
          mode="create"
          userEmail={email ?? undefined}
        />
      </div>
    </main>
  );
}
