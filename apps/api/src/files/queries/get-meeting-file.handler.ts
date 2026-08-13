import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { MeetingFile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingFileQuery } from './get-meeting-file.query';

@QueryHandler(GetMeetingFileQuery)
export class GetMeetingFileHandler implements IQueryHandler<GetMeetingFileQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMeetingFileQuery): Promise<MeetingFile> {
    const file = await this.prisma.meetingFile.findFirst({
      where: {
        id: query.fileId,
        meetingId: query.meetingId,
        userId: query.userId,
      },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }
}
