import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FindUserByEmailQuery } from './find-user-by-email.query';

@QueryHandler(FindUserByEmailQuery)
export class FindUserByEmailHandler implements IQueryHandler<FindUserByEmailQuery> {
  constructor(private readonly prisma: PrismaService) {}

  execute(query: FindUserByEmailQuery): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: query.email.toLowerCase() },
    });
  }
}
