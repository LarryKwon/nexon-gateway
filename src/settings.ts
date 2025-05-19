import { dotEnvOptions } from './dotenv-options'
import * as dotenv from 'dotenv'

dotenv.config(dotEnvOptions)
console.log(`NODE_ENV environment: ${process.env.NODE_ENV}`)

const getJwtConfig = () => ({
  secret: process.env.JWT_SECRET
})

const getMongoConfig = () => ({
  url: process.env.DATABASE_URL
})

const getServiceConfig = () => ({
  event: process.env.EVENT_SERVICE_URL,
  auth: process.env.AUTH_SERVICE_URL
})

export default () => ({
  dbConfig: () => getMongoConfig(),
  jwtConfig: () => getJwtConfig(),
  serviceConfig: () => getServiceConfig()
})