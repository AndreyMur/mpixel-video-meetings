import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import { createWriteStream } from 'node:fs';
import { Readable, pipeline } from 'node:stream';
import { promisify } from 'node:util';

const streamPipeline = promisify(pipeline);

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    this.bucket = configService.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      endpoint: configService.getOrThrow<string>('S3_ENDPOINT'),
      region: configService.get<string>('S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: configService.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: configService.getOrThrow<string>('S3_SECRET_KEY'),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async putObject(
    key: string,
    body: Buffer | Readable,
    contentType?: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<GetObjectCommandOutput> {
    return this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async downloadToFile(key: string, destinationPath: string): Promise<void> {
    const object = await this.getObject(key);
    const body = object.Body as Readable;
    await streamPipeline(body, createWriteStream(destinationPath));
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
