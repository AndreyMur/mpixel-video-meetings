import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Meeting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingsQuery } from './get-meetings.query';

@QueryHandler(GetMeetingsQuery)
export class GetMeetingsHandler implements IQueryHandler<GetMeetingsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMeetingsQuery): Promise<Meeting[]> {
    return this.prisma.meeting.findMany({
      where: {
        OR: [
          { userId: query.userId },
          { accesses: { some: { userId: query.userId } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
