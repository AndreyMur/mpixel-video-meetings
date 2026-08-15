import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { PreviewService } from './preview.service';
import { ProcessToolsService } from './tools.service';

@Module({
  providers: [ProcessToolsService, MetadataService, PreviewService],
  exports: [ProcessToolsService, MetadataService, PreviewService],
})
export class ProcessToolsModule {}
