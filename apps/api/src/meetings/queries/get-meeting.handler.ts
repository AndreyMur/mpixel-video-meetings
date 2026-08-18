import { NotFoundException } from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingQuery } from './get-meeting.query';

@QueryHandler(GetMeetingQuery)
export class GetMeetingHandler implements IQueryHandler<GetMeetingQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMeetingQuery): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findFirst({
      where: {
        id: query.id,
        OR: [
          { userId: query.userId },
          { accesses: { some: { userId: query.userId } } },
        ],
      },
    });
    if (meeting) {
      return meeting;
    }

    const candidate = await this.prisma.meeting.findUnique({
      where: { id: query.id },
    });
    if (!candidate) {
      throw new NotFoundException('Meeting not found');
    }

    const email = query.email.toLowerCase();
    if (
      !candidate.participants.some(
        (participant) => participant.toLowerCase() === email,
      )
    ) {
      throw new NotFoundException('Meeting not found');
    }

    await this.prisma.meetingAccess.upsert({
      where: {
        meetingId_userId: { meetingId: query.id, userId: query.userId },
      },
      create: { meetingId: query.id, userId: query.userId },
      update: {},
    });

    return candidate;
  }
}
