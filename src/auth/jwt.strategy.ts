import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import settings from '../settings';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: settings().jwtConfig().secret,
    });
  }

  async validate(payload: any) {
    console.log(payload)
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
  }
}
