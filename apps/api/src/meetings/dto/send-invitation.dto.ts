import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendInvitationDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
