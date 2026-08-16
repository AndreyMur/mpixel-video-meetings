import { open } from 'node:fs/promises';

const HEAD_SIZE = 4096;

function hasSignature(
  buffer: Buffer,
  offset: number,
  bytes: number[],
): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function isPng(head: Buffer): boolean {
  return (
    head.length >= 8 &&
    hasSignature(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
}

function isJpeg(head: Buffer): boolean {
  return head.length >= 3 && hasSignature(head, 0, [0xff, 0xd8, 0xff]);
}

function isWebp(head: Buffer): boolean {
  return (
    head.length >= 12 &&
    hasSignature(head, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasSignature(head, 8, [0x57, 0x45, 0x42, 0x50])
  );
}

const IMAGE_BY_EXTENSION: Record<string, (head: Buffer) => boolean> = {
  png: isPng,
  jpg: isJpeg,
  jpeg: isJpeg,
  webp: isWebp,
};

export async function verifyImageType(
  filePath: string,
  extension: string,
): Promise<boolean> {
  const verify = IMAGE_BY_EXTENSION[extension];
  if (!verify) {
    return false;
  }

  const handle = await open(filePath, 'r');
  try {
    const head = Buffer.alloc(HEAD_SIZE);
    const { bytesRead } = await handle.read(head, 0, HEAD_SIZE, 0);
    return verify(head.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}
