import { Module } from '@nestjs/common';
import { GatewayController } from './app.controller';
import { AppService } from './app.service';
import { MongooseModule } from '@nestjs/mongoose';
import settings from './settings';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forRoot(settings().dbConfig().url),
    HttpModule,
  ],
  controllers: [GatewayController],
  providers: [AppService],
})
export class AppModule {}
