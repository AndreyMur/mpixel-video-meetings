import { ApiError, parseError, parseErrorPayload } from '@/lib/auth';

export interface UserProfile {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export const AVATAR_ALLOWED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
] as const;

export type AvatarExtension = (typeof AVATAR_ALLOWED_EXTENSIONS)[number];

export function getAvatarExtension(name: string): string {
  return name.includes('.') ? (name.split('.').pop()?.toLowerCase() ?? '') : '';
}

export function validateAvatar(file: File): string | null {
  const extension = getAvatarExtension(file.name);
  if (!(AVATAR_ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return `Неподдерживаемый формат изображения: ${extension || 'без расширения'}. Разрешены: png, jpg, jpeg, webp.`;
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return 'Изображение превышает максимальный размер 5 МБ';
  }
  return null;
}

export async function getProfile(token: string): Promise<UserProfile> {
  const res = await fetch('/api/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as UserProfile;
}

export async function updateName(
  token: string,
  name: string,
): Promise<UserProfile> {
  const res = await fetch('/api/users/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as UserProfile;
}

export async function changePassword(
  token: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch('/api/users/me/password', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  if (!res.ok) {
    throw await parseError(res);
  }
}

export interface UploadProgress {
  loaded: number;
  total: number;
}

export function uploadAvatar(
  token: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UserProfile> {
  const formData = new FormData();
  formData.append('file', file);

  return new Promise<UserProfile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/users/me/avatar');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress?.({ loaded: event.loaded, total: event.total });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UserProfile);
        } catch {
          reject(new ApiError(xhr.status, 'Некорректный ответ сервера'));
        }
        return;
      }
      reject(parseErrorPayload(xhr.status, xhr.responseText));
    });
    xhr.addEventListener('error', () => {
      reject(new Error('Не удалось загрузить аватар'));
    });
    xhr.addEventListener('abort', () => {
      reject(new Error('Загрузка прервана'));
    });

    xhr.send(formData);
  });
}

export async function deleteAvatar(token: string): Promise<void> {
  const res = await fetch('/api/users/me/avatar', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw await parseError(res);
  }
}

export async function fetchAvatarSrc(token: string): Promise<string | null> {
  const res = await fetch('/api/users/me/avatar', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw await parseError(res);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
