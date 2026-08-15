import { ApiError, parseError, parseErrorPayload } from '@/lib/auth';

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

export function getFileExtension(name: string): string {
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

export interface UploadProgress {
  loaded: number;
  total: number;
}

export function uploadMeetingFile(
  meetingId: string,
  token: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<MeetingFile> {
  const formData = new FormData();
  formData.append('file', file);

  return new Promise<MeetingFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/meetings/${meetingId}/files`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.({ loaded: event.loaded, total: event.total });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as MeetingFile);
        } catch {
          reject(new ApiError(xhr.status, 'Некорректный ответ сервера'));
        }
        return;
      }
      reject(parseErrorPayload(xhr.status, xhr.responseText));
    });
    xhr.addEventListener('error', () => {
      reject(new Error('Не удалось загрузить файл'));
    });
    xhr.addEventListener('abort', () => {
      reject(new Error('Загрузка прервана'));
    });

    xhr.send(formData);
  });
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
