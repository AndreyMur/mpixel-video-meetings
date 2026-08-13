import { FileStatus } from '@prisma/client';

export class MeetingFileResponse {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: FileStatus;
  metadata: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: Date;
}

export function toMeetingFileResponse(file: {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: FileStatus;
  metadata: unknown;
  errorMessage: string | null;
  createdAt: Date;
}): MeetingFileResponse {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    status: file.status,
    metadata: file.metadata as Record<string, unknown> | null,
    errorMessage: file.errorMessage,
    createdAt: file.createdAt,
  };
}
