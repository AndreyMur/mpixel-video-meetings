import { User } from '@prisma/client';

export interface UserProfileResponse {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export function toProfileResponse(user: User): UserProfileResponse {
  return {
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarObjectKey ? '/users/me/avatar' : null,
  };
}
