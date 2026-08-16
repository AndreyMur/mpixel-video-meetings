import { UpdateMeetingDto } from '../dto/update-meeting.dto';

export class UpdateMeetingCommand {
  constructor(
    public readonly userId: string,
    public readonly meetingId: string,
    public readonly dto: UpdateMeetingDto,
  ) {}
}
