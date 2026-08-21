import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import type { Meeting, User } from '@prisma/client';
import { LiveKitService } from '../../livekit/livekit.service';
import { FindUserByIdQuery } from '../../users/queries/find-user-by-id.query';
import type { ConferenceTokenResponse } from '../response/conference-token.response';
import { GetMeetingQuery } from '../queries/get-meeting.query';
import { CreateConferenceTokenCommand } from './create-conference-token.command';

@CommandHandler(CreateConferenceTokenCommand)
export class CreateConferenceTokenHandler implements ICommandHandler<CreateConferenceTokenCommand> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly liveKitService: LiveKitService,
  ) {}

  async execute(
    command: CreateConferenceTokenCommand,
  ): Promise<ConferenceTokenResponse> {
    const meeting = await this.queryBus.execute<GetMeetingQuery, Meeting>(
      new GetMeetingQuery(command.userId, command.meetingId, command.email),
    );

    const user = await this.queryBus.execute<FindUserByIdQuery, User | null>(
      new FindUserByIdQuery(command.userId),
    );

    const token = await this.liveKitService.createConferenceToken(meeting.id, {
      userId: command.userId,
      name: user?.name ?? null,
      email: user?.email ?? command.email,
    });

    return { token };
  }
}
