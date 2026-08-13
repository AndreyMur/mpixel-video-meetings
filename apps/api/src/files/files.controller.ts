import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MeetingFile } from '@prisma/client';
import type { Response } from 'express';
import { Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import { DeleteFileCommand } from './commands/delete-file.command';
import { UploadFileCommand } from './commands/upload-file.command';
import { FileUploadInterceptor } from './interceptors/file-upload.interceptor';
import { GetMeetingFileQuery } from './queries/get-meeting-file.query';
import { GetMeetingFilesQuery } from './queries/get-meeting-files.query';
import {
  MeetingFileResponse,
  toMeetingFileResponse,
} from './response/meeting-file.response';

const streamPipeline = promisify(pipeline);

@Controller('meetings/:meetingId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @UseInterceptors(FileUploadInterceptor)
  async upload(
    @CurrentUser() user: CurrentUserPayload,
    @Param('meetingId') meetingId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MeetingFileResponse> {
    const created = await this.createFile(user.sub, meetingId, file);
    return toMeetingFileResponse(created);
  }

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingFileResponse[]> {
    return this.queryBus.execute(new GetMeetingFilesQuery(user.sub, meetingId));
  }

  @Get(':fileId/download')
  async download(
    @CurrentUser() user: CurrentUserPayload,
    @Param('meetingId') meetingId: string,
    @Param('fileId') fileId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.getFile(user.sub, meetingId, fileId);
    const object = await this.storage.getObject(file.objectKey);
    const body = object.Body as Readable;

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    response.setHeader('Content-Length', file.size);

    const onAbort = (): void => {
      if (!response.writableEnded) {
        body.destroy();
      }
    };
    response.on('close', onAbort);
    await streamPipeline(body, response);
  }

  private getFile(
    userId: string,
    meetingId: string,
    fileId: string,
  ): Promise<MeetingFile> {
    return this.queryBus.execute(
      new GetMeetingFileQuery(userId, meetingId, fileId),
    );
  }

  private createFile(
    userId: string,
    meetingId: string,
    file: Express.Multer.File | undefined,
  ): Promise<MeetingFile> {
    return this.commandBus.execute(
      new UploadFileCommand(userId, meetingId, file),
    );
  }

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('meetingId') meetingId: string,
    @Param('fileId') fileId: string,
  ): Promise<void> {
    return this.commandBus.execute(
      new DeleteFileCommand(user.sub, meetingId, fileId),
    );
  }
}
