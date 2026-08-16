import { UpdateProfileDto } from '../dto/update-profile.dto';

export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly dto: UpdateProfileDto,
  ) {}
}
