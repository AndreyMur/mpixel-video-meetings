export const AVATAR_ALLOWED_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
]);

export const AVATAR_EXTENSION_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export const AVATAR_UPLOAD_OPTIONS = 'AVATAR_UPLOAD_OPTIONS';
