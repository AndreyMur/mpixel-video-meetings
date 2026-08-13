import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PayloadTooLargeFilter } from './files/filters/payload-too-large.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new PayloadTooLargeFilter());
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
