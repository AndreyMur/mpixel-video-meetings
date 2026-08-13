import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '@prisma/client';
import { CreateUserCommand } from '../../users/commands/create-user.command';
import { AuthResponse } from '../interfaces/auth-response.interface';
import { TokenService } from '../services/token.service';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly tokenService: TokenService,
  ) {}

  async execute(command: RegisterUserCommand): Promise<AuthResponse> {
    const user = await this.commandBus.execute<CreateUserCommand, User>(
      new CreateUserCommand(command.dto.email, command.dto.password),
    );

    return { accessToken: this.tokenService.sign(user) };
  }
}
