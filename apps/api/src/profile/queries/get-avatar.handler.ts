import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { GetAvatarQuery } from './get-avatar.query';

export interface AvatarResult {
  objectKey: string;
  mimeType: string;
}

@QueryHandler(GetAvatarQuery)
export class GetAvatarHandler implements IQueryHandler<GetAvatarQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetAvatarQuery): Promise<AvatarResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: query.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.avatarObjectKey) {
      throw new NotFoundException('Avatar not found');
    }

    const extension = user.avatarObjectKey.split('.').pop() ?? 'png';
    const mimeType =
      extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : `image/${extension}`;
    return { objectKey: user.avatarObjectKey, mimeType };
  }
}
