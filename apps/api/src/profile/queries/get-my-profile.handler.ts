import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { toProfileResponse } from '../response/user-profile.response';
import { UserProfileResponse } from '../response/user-profile.response';
import { GetMyProfileQuery } from './get-my-profile.query';

@QueryHandler(GetMyProfileQuery)
export class GetMyProfileHandler implements IQueryHandler<GetMyProfileQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetMyProfileQuery): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toProfileResponse(user);
  }
}
