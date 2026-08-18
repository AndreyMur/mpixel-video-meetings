import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MeetingFileResponse,
  toMeetingFileResponse,
} from '../response/meeting-file.response';
import { GetMeetingFilesQuery } from './get-meeting-files.query';

@QueryHandler(GetMeetingFilesQuery)
export class GetMeetingFilesHandler implements IQueryHandler<GetMeetingFilesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMeetingFilesQuery): Promise<MeetingFileResponse[]> {
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

    const files = await this.prisma.meetingFile.findMany({
      where: { meetingId: query.meetingId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        status: true,
        metadata: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return files.map(toMeetingFileResponse);
  }
}
