import { Module } from '@nestjs/common';
import { mailFromProvider, mailTransportProvider } from './email.options';
import { EmailService } from './email.service';

@Module({
  providers: [mailTransportProvider, mailFromProvider, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
