import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ProcessingModule } from '../processing/processing.module';
import { ProcessToolsModule } from '../processing/process-tools/process-tools.module';
import { StorageModule } from '../storage/storage.module';
import { FileProcessingProcessor } from './file-processing.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
    ProcessingModule,
    ProcessToolsModule,
  ],
  providers: [FileProcessingProcessor],
})
export class WorkerModule {}
