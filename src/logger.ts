import * as winston from 'winston'

const env = process.env.NODE_ENV || 'development'

export const logger = winston.createLogger({
  level: env === 'production' ? 'error' : 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
})
