'use client';

import {
  ArrowLeft,
  ArrowRightFromSquare,
  Calendar,
  CircleCheckFill,
  CircleFill,
  Clock,
  FileArrowDown,
  FileText,
  Paperclip,
  Pencil,
  TrashBin,
  TriangleExclamation,
  Video,
  Xmark,
} from '@gravity-ui/icons';
import { buttonVariants } from '@heroui/styles';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Skeleton,
  Spinner,
  Table,
  Toast,
  Tooltip,
} from '@heroui/react';
import { FileUploadArea } from '@/components/file-upload-area';
import { ParticipantsDropdown } from '@/components/participants-dropdown';
import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  getMeeting,
  getSessionUser,
  type Meeting,
} from '@/lib/auth';
import {
  deleteMeetingFile,
  downloadMeetingFile,
  getFileExtension,
  getMeetingFiles,
  type FileStatus,
  type MeetingFile,
  uploadMeetingFile,
  validateMeetingFile,
} from '@/lib/files';
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

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} КБ`;
  }
  return `${(kb / 1024).toFixed(1)} МБ`;
}

function getFileKind(name: string): string {
  const ext = getFileExtension(name);
  if (['mp3', 'wav', 'm4a'].includes(ext)) {
    return 'Аудио';
  }
  if (['mp4', 'webm'].includes(ext)) {
    return 'Видео';
  }
  if (ext === 'pdf') {
    return 'PDF';
  }
  if (['doc', 'docx'].includes(ext)) {
    return 'Документ';
  }
  if (['xls', 'xlsx'].includes(ext)) {
    return 'Таблица';
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return 'Презентация';
  }
  if (ext === 'txt') {
    return 'Текст';
  }
  return 'Файл';
}

function FileStatusChip({
  status,
  errorMessage,
}: {
  status: FileStatus;
  errorMessage: string | null;
}) {
  if (status === 'READY') {
    return (
      <Chip color="success" variant="soft">
        <CircleCheckFill className="size-3.5" />
        <Chip.Label>Готово</Chip.Label>
      </Chip>
    );
  }
  if (status === 'FAILED') {
    return (
      <Tooltip>
        <Chip color="danger" variant="soft">
          <Xmark className="size-3.5" />
          <Chip.Label>Ошибка</Chip.Label>
        </Chip>
        <Tooltip.Content>
          <p className="max-w-xs">
            {errorMessage ?? 'Не удалось обработать файл'}
          </p>
        </Tooltip.Content>
      </Tooltip>
    );
  }
  if (status === 'PROCESSING') {
    return (
      <Chip color="warning" variant="soft">
        <Clock className="size-3.5" />
        <Chip.Label>Обработка</Chip.Label>
      </Chip>
    );
  }
  return (
    <Chip variant="soft">
      <CircleFill className="size-3.5" />
      <Chip.Label>Загружен</Chip.Label>
    </Chip>
  );
}

function FilesTableSkeleton() {
  const rows = Array.from({ length: 3 });
  return (
    <Card variant="secondary">
      <Card.Content className="flex flex-col gap-3">
        {rows.map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/5 rounded-md" />
              <Skeleton className="h-3 w-1/3 rounded-md" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const meetingId = params.id;

  const [activeMeetingId, setActiveMeetingId] = useState<string | undefined>(
    meetingId,
  );
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [files, setFiles] = useState<MeetingFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userSub, setUserSub] = useState<string | null>(null);

  if (activeMeetingId !== meetingId) {
    setActiveMeetingId(meetingId);
    setMeeting(null);
    setFiles([]);
    setIsLoading(true);
    setIsNotFound(false);
    setPageError(null);
    setEmail(null);
    setUserSub(null);
  }

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!meetingId) {
      return;
    }
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
    Promise.all([
      getMeeting(meetingId, token),
      getMeetingFiles(meetingId, token),
    ])
      .then(([meetingData, filesData]) => {
        if (cancelled) {
          return;
        }
        setEmail(user.email);
        setUserSub(user.sub);
        setMeeting(meetingData);
        setFiles(filesData);
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

  const runAuthorized = async (
    action: () => Promise<void>,
    onError: (message: string) => void,
  ) => {
    try {
      await action();
      setPageError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAccessToken();
        router.replace('/login');
        return;
      }
      onError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const upload = async (file: File) => {
    const token = getAccessToken();
    if (!token || !meetingId) {
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    await runAuthorized(
      async () => {
        await uploadMeetingFile(meetingId, token, file, (progress) => {
          const percent =
            progress.total > 0
              ? Math.round((progress.loaded / progress.total) * 100)
              : 0;
          setUploadProgress(percent);
        });
        try {
          const freshFiles = await getMeetingFiles(meetingId, token);
          setFiles(freshFiles);
        } catch {
          setUploadError(
            'Файл загружен, но не удалось обновить список. Обновите страницу.',
          );
        }
        setUploadProgress(null);
      },
      (message) => {
        setUploadProgress(null);
        setUploadError(message);
      },
    );
    setIsUploading(false);
  };

  const handleFiles = (files: File[]): boolean => {
    const file = files[0];
    if (!file || isUploading) {
      return false;
    }
    const validationError = validateMeetingFile(file);
    if (validationError) {
      setUploadError(validationError);
      return false;
    }
    setUploadError(null);
    void upload(file);
    return true;
  };

  const handleDelete = async (file: MeetingFile) => {
    const token = getAccessToken();
    if (!token || !meetingId || deletingFileId === file.id) {
      return;
    }
    setDeletingFileId(file.id);
    await runAuthorized(
      async () => {
        await deleteMeetingFile(meetingId, file.id, token);
        setFiles((prev) => prev.filter((item) => item.id !== file.id));
      },
      (message) => setPageError(message),
    );
    setDeletingFileId(null);
  };

  const handleDownload = async (file: MeetingFile) => {
    const token = getAccessToken();
    if (!token || !meetingId) {
      return;
    }
    setDownloadingFileId(file.id);
    await runAuthorized(
      async () => {
        const blob = await downloadMeetingFile(meetingId, file.id, token);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      (message) => setPageError(message),
    );
    setDownloadingFileId(null);
  };

  const handleDeleteMeeting = async () => {
    const token = getAccessToken();
    if (!token || !meetingId || isDeleting) {
      return;
    }
    setIsDeleting(true);
    await runAuthorized(
      async () => {
        await deleteMeeting(token, meetingId);
        router.push('/meetings');
      },
      (message) => setPageError(message),
    );
    setIsDeleting(false);
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
          <Skeleton className="h-10 w-3/5 rounded-md" />
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <FilesTableSkeleton />
        </div>
      </main>
    );
  }

  if (isNotFound) {
    return (
      <main className="flex min-h-dvh flex-col bg-background">
        {header}
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
          <Video className="size-12 text-muted" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Встреча не найдена
          </h1>
          <p className="max-w-sm text-sm text-muted">
            Встреча не существует или у вас нет доступа к её файлам.
          </p>
          <Button variant="secondary" onPress={() => router.push('/')}>
            <ArrowLeft className="size-4" />К списку встреч
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {header}

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground"
            >
              <ArrowLeft className="size-4" />К списку встреч
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">
              {meeting?.title ?? 'Встреча'}
            </h1>
            {meeting?.description ? (
              <p className="text-sm text-muted">{meeting.description}</p>
            ) : null}
            {meeting ? (
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <Calendar aria-hidden="true" className="size-4" />
                  {formatDate(meeting.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock aria-hidden="true" className="size-4" />
                  {formatTime(meeting.date)}
                </span>
                <ParticipantsDropdown
                  meetingId={meeting.id}
                  participants={meeting.participants}
                  isOrganizer={meeting.userId === userSub}
                  ownEmail={email ?? ''}
                />
              </p>
            ) : null}
          </div>
          {meeting ? (
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip>
                <Link
                  href={`/meetings/${meeting.id}/edit`}
                  aria-label={`Изменить ${meeting.title}`}
                  className={`${buttonVariants({
                    isIconOnly: true,
                    size: 'sm',
                    variant: 'tertiary',
                  })} min-h-11 min-w-11`}
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
                  className="min-h-11 min-w-11"
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
                        <AlertDialog.Heading>
                          Удалить встречу?
                        </AlertDialog.Heading>
                      </AlertDialog.Header>
                      <AlertDialog.Body>
                        <p>
                          Встреча «{meeting.title}» будет удалена без
                          возможности восстановления.
                        </p>
                      </AlertDialog.Body>
                      <AlertDialog.Footer>
                        <Button variant="tertiary" slot="close">
                          Отмена
                        </Button>
                        <Button
                          variant="danger"
                          slot="close"
                          isDisabled={isDeleting}
                          isPending={isDeleting}
                          onPress={() => void handleDeleteMeeting()}
                        >
                          Удалить
                        </Button>
                      </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                  </AlertDialog.Container>
                </AlertDialog.Backdrop>
              </AlertDialog>
            </div>
          ) : null}
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

        <section className="flex flex-col gap-4">
          <FileUploadArea
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            onUploadFiles={handleFiles}
          />

          {files.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Paperclip className="size-9 text-muted" />
              <p className="text-base font-medium text-foreground">
                Пока нет ни одного файла
              </p>
              <p className="max-w-sm text-sm text-muted">
                Загрузите первый файл встречи, и он появится в этом списке.
              </p>
            </div>
          ) : (
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Файлы встречи"
                  className="min-w-[560px]"
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Файл</Table.Column>
                    <Table.Column>Размер</Table.Column>
                    <Table.Column>Загружен</Table.Column>
                    <Table.Column>Статус</Table.Column>
                    <Table.Column />
                  </Table.Header>
                  <Table.Body>
                    {files.map((file) => (
                      <Table.Row key={file.id}>
                        <Table.Cell>
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                              <FileText className="size-4.5" />
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">
                                {file.name}
                              </span>
                              <span className="text-xs text-muted">
                                {getFileKind(file.name)}
                              </span>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-sm text-muted">
                            {formatSize(file.size)}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="text-sm text-muted">
                            {formatDate(file.createdAt)}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <FileStatusChip
                            status={file.status}
                            errorMessage={file.errorMessage}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <Button
                                isIconOnly
                                variant="tertiary"
                                size="sm"
                                className="min-h-11 min-w-11"
                                aria-label={`Скачать ${file.name}`}
                                isDisabled={deletingFileId === file.id}
                                isPending={downloadingFileId === file.id}
                                onPress={() => void handleDownload(file)}
                              >
                                {downloadingFileId === file.id ? (
                                  <Spinner color="current" size="sm" />
                                ) : (
                                  <FileArrowDown className="size-4" />
                                )}
                              </Button>
                              <Tooltip.Content>Скачать</Tooltip.Content>
                            </Tooltip>
                            <AlertDialog>
                              <Button
                                isIconOnly
                                variant="danger-soft"
                                size="sm"
                                className="min-h-11 min-w-11"
                                aria-label={`Удалить ${file.name}`}
                                isDisabled={
                                  downloadingFileId === file.id ||
                                  deletingFileId === file.id
                                }
                                isPending={deletingFileId === file.id}
                              >
                                {deletingFileId === file.id ? (
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
                                      <AlertDialog.Heading>
                                        Удалить файл?
                                      </AlertDialog.Heading>
                                    </AlertDialog.Header>
                                    <AlertDialog.Body>
                                      <p>
                                        Файл «{file.name}» будет удалён без
                                        возможности восстановления.
                                      </p>
                                    </AlertDialog.Body>
                                    <AlertDialog.Footer>
                                      <Button variant="tertiary" slot="close">
                                        Отмена
                                      </Button>
                                      <Button
                                        variant="danger"
                                        isDisabled={deletingFileId === file.id}
                                        isPending={deletingFileId === file.id}
                                        onPress={() => void handleDelete(file)}
                                      >
                                        Удалить
                                      </Button>
                                    </AlertDialog.Footer>
                                  </AlertDialog.Dialog>
                                </AlertDialog.Container>
                              </AlertDialog.Backdrop>
                            </AlertDialog>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </section>
      </div>
      <Toast.Provider />
    </main>
  );
}
