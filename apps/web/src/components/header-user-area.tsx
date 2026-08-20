'use client';

import {
  ArrowRightFromSquare,
  Person,
  TriangleExclamation,
} from '@gravity-ui/icons';
import { Avatar, Button, Tooltip } from '@heroui/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, clearAccessToken, getAccessToken } from '@/lib/auth';
import { fetchAvatarSrc, getProfile } from '@/lib/profile';

export function HeaderUserArea({
  displayName,
  avatarSrc,
}: {
  displayName?: string | null;
  avatarSrc?: string | null;
}) {
  const router = useRouter();
  const isControlled = displayName !== undefined;
  const [selfDisplayName, setSelfDisplayName] = useState<string | null>(null);
  const [selfAvatarSrc, setSelfAvatarSrc] = useState<string | null>(null);
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
      setSelfAvatarSrc(src);
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
    if (isControlled) {
      return;
    }
    const token = getAccessToken();
    if (!token) {
      return;
    }

    let cancelled = false;
    getProfile(token)
      .then((data) => {
        if (!cancelled) {
          setSelfDisplayName(data.name || data.email);
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
  }, [router, setAvatarWithUrl, isControlled]);

  const handleLogout = () => {
    clearAccessToken();
    router.replace('/login');
  };

  const resolvedName = displayName ?? selfDisplayName;
  const resolvedAvatarSrc = avatarSrc !== undefined ? avatarSrc : selfAvatarSrc;

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/profile"
        aria-label={resolvedName ? `Профиль: ${resolvedName}` : 'Профиль'}
        className="flex min-h-11 items-center gap-2 rounded-full p-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Avatar size="sm" className="size-9">
          {resolvedAvatarSrc ? (
            <Avatar.Image alt="Аватар пользователя" src={resolvedAvatarSrc} />
          ) : null}
          <Avatar.Fallback>
            <Person className="size-4" />
          </Avatar.Fallback>
        </Avatar>
        {resolvedName ? (
          <span className="hidden max-w-40 truncate text-sm text-muted sm:block">
            {resolvedName}
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
}
