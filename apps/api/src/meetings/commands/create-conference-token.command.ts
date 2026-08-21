export class CreateConferenceTokenCommand {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly meetingId: string,
  ) {}
}
