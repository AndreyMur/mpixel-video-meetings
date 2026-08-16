import type { Express } from 'express';

export class UploadAvatarCommand {
  constructor(
    public readonly userId: string,
    public readonly file?: Express.Multer.File,
  ) {}
}
