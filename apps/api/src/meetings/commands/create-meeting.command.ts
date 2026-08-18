import { CreateMeetingDto } from '../dto/create-meeting.dto';

export class CreateMeetingCommand {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly dto: CreateMeetingDto,
  ) {}
}
