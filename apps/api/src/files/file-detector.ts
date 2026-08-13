import { open } from 'node:fs/promises';

const HEAD_SIZE = 4096;

function hasSignature(
  buffer: Buffer,
  offset: number,
  bytes: number[],
): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function isOle2(head: Buffer): boolean {
  return (
    head.length >= 8 &&
    hasSignature(head, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  );
}

function isZip(head: Buffer): boolean {
  return head.length >= 4 && hasSignature(head, 0, [0x50, 0x4b, 0x03, 0x04]);
}

function isPdf(head: Buffer): boolean {
  return (
    head.length >= 5 && hasSignature(head, 0, [0x25, 0x50, 0x44, 0x46, 0x2d])
  );
}

function isMp3(head: Buffer): boolean {
  if (head.length >= 3 && hasSignature(head, 0, [0x49, 0x44, 0x33])) {
    return true;
  }
  return head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
}

function isWav(head: Buffer): boolean {
  return (
    head.length >= 12 &&
    hasSignature(head, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasSignature(head, 8, [0x57, 0x41, 0x56, 0x45])
  );
}

function isIsoMp4(head: Buffer): boolean {
  return head.length >= 8 && hasSignature(head, 4, [0x66, 0x74, 0x79, 0x70]);
}

function isWebm(head: Buffer): boolean {
  return head.length >= 4 && hasSignature(head, 0, [0x1a, 0x45, 0xdf, 0xa3]);
}

function isText(head: Buffer): boolean {
  if (head.length === 0) {
    return true;
  }
  let offset = 0;
  if (hasSignature(head, 0, [0xef, 0xbb, 0xbf])) {
    offset = 3;
  } else if (hasSignature(head, 0, [0xff, 0xfe])) {
    offset = 2;
  } else if (hasSignature(head, 0, [0xfe, 0xff])) {
    offset = 2;
  }
  for (let index = offset; index < head.length; index += 1) {
    const byte = head[index];
    if (byte === 0x00 || (byte > 0x7f && byte < 0xc0)) {
      return false;
    }
  }
  return true;
}

const FAMILY_BY_EXTENSION: Record<string, (head: Buffer) => boolean> = {
  pdf: isPdf,
  doc: isOle2,
  xls: isOle2,
  ppt: isOle2,
  docx: isZip,
  xlsx: isZip,
  pptx: isZip,
  mp3: isMp3,
  wav: isWav,
  m4a: isIsoMp4,
  mp4: isIsoMp4,
  webm: isWebm,
  txt: isText,
};

export async function verifyFileType(
  filePath: string,
  extension: string,
): Promise<boolean> {
  const verify = FAMILY_BY_EXTENSION[extension];
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
