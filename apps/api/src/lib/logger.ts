import pino from 'pino';
import { env, isTest } from '../env';

export const logger = pino({
  level: env.LOG_LEVEL ?? (isTest ? 'silent' : 'info'),
  redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.token'],
  ...(env.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty', options: { singleLine: true } } } : {}),
});
