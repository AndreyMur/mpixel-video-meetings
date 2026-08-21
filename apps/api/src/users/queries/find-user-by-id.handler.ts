import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FindUserByIdQuery } from './find-user-by-id.query';

@QueryHandler(FindUserByIdQuery)
export class FindUserByIdHandler implements IQueryHandler<FindUserByIdQuery> {
  constructor(private readonly prisma: PrismaService) {}

  execute(query: FindUserByIdQuery): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: query.id } });
  }
}
