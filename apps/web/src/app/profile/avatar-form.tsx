'use client';

import {
  CloudArrowUpIn,
  Person,
  TrashBin,
  TriangleExclamation,
} from '@gravity-ui/icons';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  AlertDialog,
  Avatar,
  Button,
  Card,
  ProgressBar,
  Spinner,
} from '@heroui/react';
import { ApiError, clearAccessToken } from '@/lib/auth';
import {
  deleteAvatar,
  uploadAvatar,
  validateAvatar,
  type UserProfile,
} from '@/lib/profile';

export const AVATAR_ACCEPT = '.png,.jpg,.jpeg,.webp';

interface AvatarFieldProps {
  token: string;
  profile: UserProfile;
  avatarSrc: string | null;
  onProfileChanged: (profile: UserProfile) => void;
}

export function AvatarField({
  token,
  profile,
  avatarSrc,
  onProfileChanged,
}: AvatarFieldProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const displayName = profile.name || profile.email;

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isUploading) {
      return;
    }
    const validationError = validateAvatar(file);
    if (validationError) {
      setUploadError(validationError);
      setSelectedFile(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    void upload(file);
  };

  const upload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const updated = await uploadAvatar(token, file, (progress) => {
        const percent =
          progress.total > 0
            ? Math.round((progress.loaded / progress.total) * 100)
            : 0;
        setUploadProgress(percent);
      });
      onProfileChanged(updated);
      setSelectedFile(null);
      setUploadProgress(null);
    } catch (error) {
      setUploadProgress(null);
      if (error instanceof ApiError && error.status === 401) {
        clearAccessToken();
        router.replace('/login');
        return;
      }
      setUploadError(
        error instanceof Error ? error.message : 'Something went wrong',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setUploadError(null);
    try {
      await deleteAvatar(token);
      const updated = { ...profile, avatarUrl: null };
      onProfileChanged(updated);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearAccessToken();
        router.replace('/login');
        return;
      }
      setUploadError(
        error instanceof Error ? error.message : 'Something went wrong',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="w-full" variant="secondary">
      <Card.Header className="items-center gap-4">
        <Avatar size="lg" className="size-20 text-2xl">
          {avatarSrc ? (
            <Avatar.Image alt="Аватар пользователя" src={avatarSrc} />
          ) : null}
          <Avatar.Fallback>
            <Person className="size-8" />
          </Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <Card.Title className="truncate text-lg">{displayName}</Card.Title>
          <Card.Description className="truncate">
            {profile.email}
          </Card.Description>
        </div>
      </Card.Header>

      <Card.Content className="flex flex-col gap-3">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={AVATAR_ACCEPT}
          onChange={handleInputChange}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            isPending={isUploading}
            isDisabled={isUploading || isDeleting}
            onPress={() => inputRef.current?.click()}
          >
            {({ isPending: loading }) => (
              <>
                {loading ? (
                  <Spinner color="current" size="sm" aria-hidden="true" />
                ) : (
                  <CloudArrowUpIn className="size-4" />
                )}
                {loading ? 'Загрузка…' : 'Загрузить аватар'}
              </>
            )}
          </Button>

          {avatarSrc ? (
            <AlertDialog>
              <Button
                variant="danger-soft"
                isDisabled={isUploading || isDeleting}
                isPending={isDeleting}
              >
                {isDeleting ? (
                  <Spinner color="current" size="sm" />
                ) : (
                  <TrashBin className="size-4" />
                )}
                Удалить
              </Button>
              <AlertDialog.Backdrop>
                <AlertDialog.Container>
                  <AlertDialog.Dialog>
                    <AlertDialog.Header>
                      <AlertDialog.Icon />
                      <AlertDialog.Heading>Удалить аватар?</AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p>
                        Ваш аватар будет удалён без возможности восстановления.
                      </p>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button variant="tertiary" slot="close">
                        Отмена
                      </Button>
                      <Button
                        variant="danger"
                        isDisabled={isDeleting}
                        isPending={isDeleting}
                        onPress={() => void handleDelete()}
                      >
                        Удалить
                      </Button>
                    </AlertDialog.Footer>
                  </AlertDialog.Dialog>
                </AlertDialog.Container>
              </AlertDialog.Backdrop>
            </AlertDialog>
          ) : null}
        </div>

        {isUploading && uploadProgress !== null ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Загрузка «{selectedFile?.name}»</span>
              <span role="status">{uploadProgress}%</span>
            </div>
            <ProgressBar
              value={uploadProgress}
              color="accent"
              size="sm"
              aria-label="Прогресс загрузки аватара"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        ) : null}

        {uploadError ? (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-danger"
          >
            <TriangleExclamation className="size-4 shrink-0" />
            {uploadError}
          </p>
        ) : null}
      </Card.Content>
    </Card>
  );
}
