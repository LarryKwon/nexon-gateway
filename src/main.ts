import { NestFactory } from '@nestjs/core';
import * as csurf from 'csurf';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import settings from './settings';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(settings().corsConfig());

  app.use(cookieParser());
  app.use(
    '/',
    csurf({
      cookie: { key: 'csrftoken' },
      ignoreMethods: [
        'GET',
        'HEAD',
        'OPTIONS',
        'DELETE',
        'PATCH',
        'PUT',
        'POST',
      ],
    }),
  );
  await app.listen(3000);
}
bootstrap();
