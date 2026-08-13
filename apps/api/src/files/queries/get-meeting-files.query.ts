export class GetMeetingFilesQuery {
  constructor(
    public readonly userId: string,
    public readonly meetingId: string,
  ) {}
}
