import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateUserHandler } from './commands/create-user.handler';
import { FindUserByEmailHandler } from './queries/find-user-by-email.handler';
import { FindUserByIdHandler } from './queries/find-user-by-id.handler';

@Module({
  imports: [CqrsModule],
  providers: [CreateUserHandler, FindUserByEmailHandler, FindUserByIdHandler],
  exports: [CqrsModule],
})
export class UsersModule {}
