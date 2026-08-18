import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { MeetingFile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingFileQuery } from './get-meeting-file.query';

@QueryHandler(GetMeetingFileQuery)
export class GetMeetingFileHandler implements IQueryHandler<GetMeetingFileQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMeetingFileQuery): Promise<MeetingFile> {
    const meeting = await this.prisma.meeting.findFirst({
      where: {
        id: query.meetingId,
        OR: [
          { userId: query.userId },
          { accesses: { some: { userId: query.userId } } },
        ],
      },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const file = await this.prisma.meetingFile.findFirst({
      where: {
        id: query.fileId,
        meetingId: query.meetingId,
      },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }
}
