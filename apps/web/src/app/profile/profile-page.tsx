'use client';

import {
  ArrowLeft,
  ArrowRightFromSquare,
  TriangleExclamation,
  Video,
} from '@gravity-ui/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Card, Skeleton } from '@heroui/react';
import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  getSessionUser,
} from '@/lib/auth';
import { fetchAvatarSrc, getProfile, type UserProfile } from '@/lib/profile';
import { AvatarField } from './avatar-form';
import { NameForm } from './name-form';
import { PasswordForm } from './password-form';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

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

    let cancelled = false;
    Promise.all([getProfile(accessToken), fetchAvatarSrc(accessToken)])
      .then(([profileData, src]) => {
        if (cancelled) {
          return;
        }
        setProfile(profileData);
        setAvatarSrc(src);
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
  }, [router]);

  const token = getAccessToken();
  const email = profile?.email ?? null;

  const handleLogout = () => {
    clearAccessToken();
    router.replace('/login');
  };

  const handleProfileChanged = async (updated: UserProfile) => {
    setProfile(updated);
    if (!token) {
      return;
    }
    try {
      const src = await fetchAvatarSrc(token);
      setAvatarSrc((prev) => {
        if (prev && prev !== src) {
          URL.revokeObjectURL(prev);
        }
        return src;
      });
    } catch {
      setAvatarSrc((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    }
  };

  const handleNameChanged = (updated: UserProfile) => {
    setProfile(updated);
  };

  const header = (
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
  );

  if (isLoading) {
    return (
      <main className="flex min-h-dvh flex-col bg-background">
        {header}
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {header}

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />К списку встреч
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Профиль</h1>
        </div>

        {pageError ? (
          <Card variant="secondary">
            <Card.Content>
              <p
                role="alert"
                className="flex items-center gap-2 text-sm text-danger"
              >
                <TriangleExclamation className="size-4 shrink-0" />
                {pageError}
              </p>
            </Card.Content>
          </Card>
        ) : null}

        {profile && token ? (
          <>
            <AvatarField
              token={token}
              profile={profile}
              avatarSrc={avatarSrc}
              onProfileChanged={handleProfileChanged}
            />
            <NameForm
              token={token}
              name={profile.name}
              onNameChanged={handleNameChanged}
            />
            <PasswordForm token={token} />
          </>
        ) : null}
      </div>
    </main>
  );
}
