import { Module } from '@nestjs/common';
import {GatewayController} from './app.controller';
import { AppService } from './app.service';
import {MongooseModule} from "@nestjs/mongoose";
import settings from "./settings";
import {HttpModule, HttpService} from "@nestjs/axios";

@Module({
  imports: [
    MongooseModule.forRoot(settings().dbConfig().url),
    HttpModule
  ],
  controllers: [GatewayController],
  providers: [AppService],
})
export class AppModule {}
