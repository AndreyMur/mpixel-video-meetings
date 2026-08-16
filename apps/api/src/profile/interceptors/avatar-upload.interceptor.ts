import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { AVATAR_UPLOAD_OPTIONS } from '../avatar.constants';

@Injectable()
export class AvatarUploadInterceptor implements NestInterceptor {
  constructor(
    @Inject(AVATAR_UPLOAD_OPTIONS) private readonly options: MulterOptions,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const interceptor = new (FileInterceptor('file', this.options))();
    return interceptor.intercept(context, next);
  }
}
