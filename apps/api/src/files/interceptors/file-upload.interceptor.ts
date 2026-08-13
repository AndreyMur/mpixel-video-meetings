import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { FILE_UPLOAD_OPTIONS } from '../files.constants';

@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  constructor(
    @Inject(FILE_UPLOAD_OPTIONS) private readonly options: MulterOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const interceptor = new (FileInterceptor('file', this.options))();
    return interceptor.intercept(context, next);
  }
}
