export class SendInvitationCommand {
  constructor(
    public readonly userId: string,
    public readonly organizerEmail: string,
    public readonly meetingId: string,
    public readonly email: string,
  ) {}
}
