export class GetMeetingQuery {
  constructor(
    public readonly userId: string,
    public readonly id: string,
    public readonly email: string,
  ) {}
}
