import { dotEnvOptions } from './dotenv-options';
import * as dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config(dotEnvOptions);
console.log(`NODE_ENV environment: ${process.env.NODE_ENV}`);

const getCorsConfig = () => {
  const { NODE_ENV } = process.env;
  if (NODE_ENV === 'prod') {
    return {
      origin: [
        'http://localhost:3001',
        'http://localhost:3000',
        'http://localhost:3002',
      ],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };
  }
  if (NODE_ENV === 'dev') {
    return {
      origin: [
        'http://localhost:3001',
        'http://localhost:3000',
        'http://localhost:3002',
      ],
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };
  }
  return {
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:3002',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };
};

const getJwtConfig = () => ({
  secret: process.env.JWT_ACCESS_SECRET,
});

const getMongoConfig = () => ({
  url: process.env.DATABASE_URL,
});

const getServiceConfig = () => ({
  event: process.env.EVENT_SERVICE_URL,
  auth: process.env.AUTH_SERVICE_URL,
});

export default () => ({
  dbConfig: () => getMongoConfig(),
  jwtConfig: () => getJwtConfig(),
  serviceConfig: () => getServiceConfig(),
  corsConfig: () => getCorsConfig(),
});
