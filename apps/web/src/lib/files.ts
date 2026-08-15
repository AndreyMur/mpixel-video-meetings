import { parseError } from '@/lib/auth';

export type FileStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface MeetingFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: FileStatus;
  metadata: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
}

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'txt',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'mp3',
  'wav',
  'm4a',
  'mp4',
  'webm',
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

function getFileExtension(name: string): string {
  return name.includes('.') ? (name.split('.').pop()?.toLowerCase() ?? '') : '';
}

export function isAllowedFile(file: Pick<File, 'name'>): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(
    getFileExtension(file.name),
  );
}

export function validateMeetingFile(file: File): string | null {
  if (!isAllowedFile(file)) {
    const allowed = ALLOWED_EXTENSIONS.join(', ');
    return `Неподдерживаемый формат файла: ${getFileExtension(file.name) || 'без расширения'}. Разрешены: ${allowed}`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'Файл превышает максимальный размер 50 МБ';
  }
  return null;
}

export async function getMeetingFiles(
  meetingId: string,
  token: string,
): Promise<MeetingFile[]> {
  const res = await fetch(`/api/meetings/${meetingId}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as MeetingFile[];
}

export async function uploadMeetingFile(
  meetingId: string,
  token: string,
  file: File,
): Promise<MeetingFile> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/meetings/${meetingId}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as MeetingFile;
}

export async function deleteMeetingFile(
  meetingId: string,
  fileId: string,
  token: string,
): Promise<void> {
  const res = await fetch(`/api/meetings/${meetingId}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await parseError(res);
  }
}

export async function downloadMeetingFile(
  meetingId: string,
  fileId: string,
  token: string,
): Promise<Blob> {
  const res = await fetch(
    `/api/meetings/${meetingId}/files/${fileId}/download`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    throw await parseError(res);
  }

  return res.blob();
}
