import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { MAIL_FROM, MAIL_TRANSPORT } from './email.constants';

export const mailTransportProvider: Provider = {
  provide: MAIL_TRANSPORT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Transporter => {
    const host = configService.get<string>('SMTP_HOST');
    if (!host) {
      return {
        sendMail: () => Promise.resolve(undefined),
      } as unknown as Transporter;
    }
    const port = toPositiveInt(configService.get<string>('SMTP_PORT'), 587);
    const secure = isTruthy(configService.get<string>('SMTP_SECURE', 'false'));
    const user = configService.get<string>('SMTP_USER');
    const pass = configService.get<string>('SMTP_PASS');
    return createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass: pass ?? '' } : undefined,
    });
  },
};

export const mailFromProvider: Provider = {
  provide: MAIL_FROM,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): string =>
    configService.get<string>('SMTP_FROM', 'MPixel <no-reply@mpixel.local>'),
};

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isTruthy(value: string | undefined): boolean {
  return value === undefined
    ? false
    : ['true', '1'].includes(value.toLowerCase());
}
