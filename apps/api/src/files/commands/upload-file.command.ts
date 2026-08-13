import type { Express } from 'express';

export class UploadFileCommand {
  constructor(
    public readonly userId: string,
    public readonly meetingId: string,
    public readonly file?: Express.Multer.File,
  ) {}
}
