import { ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { AuthResponse } from '../interfaces/auth-response.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../services/token.service';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: RegisterUserCommand): Promise<AuthResponse> {
    const email = command.dto.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(command.dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    return { accessToken: this.tokenService.sign(user) };
  }
}
