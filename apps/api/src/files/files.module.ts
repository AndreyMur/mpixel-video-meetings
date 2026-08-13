import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import type { Provider } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesController } from './files.controller';
import { FILE_UPLOAD_OPTIONS } from './files.constants';
import { createFileUploadOptions } from './file-upload.options';
import { UploadFileHandler } from './commands/upload-file.handler';
import { GetMeetingFileHandler } from './queries/get-meeting-file.handler';
import { GetMeetingFilesHandler } from './queries/get-meeting-files.handler';
import { DeleteFileHandler } from './commands/delete-file.handler';

const fileUploadOptionsProvider: Provider = {
  provide: FILE_UPLOAD_OPTIONS,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    createFileUploadOptions(configService),
};

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [FilesController],
  providers: [
    fileUploadOptionsProvider,
    UploadFileHandler,
    GetMeetingFileHandler,
    GetMeetingFilesHandler,
    DeleteFileHandler,
  ],
})
export class FilesModule {}
