import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { AVATAR_EXTENSION_MIME } from '../avatar.constants';
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
    return {
      objectKey: user.avatarObjectKey,
      mimeType: AVATAR_EXTENSION_MIME[extension] ?? 'application/octet-stream',
    };
  }
}
