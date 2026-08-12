import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(user: User): string {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }
}
