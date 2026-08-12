import { LoginDto } from '../dto/login.dto';

export class LoginUserQuery {
  constructor(public readonly dto: LoginDto) {}
}
