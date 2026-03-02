// ============================================================
// src/common/config/logger.config.ts
// ============================================================
import * as winston from 'winston';
import * as path from 'path';

const { format, transports } = winston;

const customFormat = format.printf(({ level, message, timestamp, context, traceId, stack }) => {
  const base = `[${timestamp}] [${level.toUpperCase()}]`;
  const ctx = context ? ` [${context}]` : '';
  const trace = traceId ? ` {traceId: ${traceId}}` : '';
  const stackTrace = stack ? `\n${stack}` : '';
  return `${base}${ctx}${trace} ${message}${stackTrace}`;
});

const commonFormats = [
  format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  format.errors({ stack: true }),
];

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    ...commonFormats,
    process.env.NODE_ENV === 'production' ? format.json() : format.combine(format.colorize(), customFormat),
  ),
  transports: [
    new transports.Console({
      silent: process.env.NODE_ENV === 'test',
    }),
    ...(process.env.NODE_ENV === 'production'
      ? [
          new transports.File({
            filename: path.resolve(__dirname, '../../../logs/error.log'),
            level: 'error',
            maxFiles: parseInt(process.env.LOG_MAX_FILES ?? '5', 10),
            maxsize: 10 * 1024 * 1024, // 10MB
          }),
          new transports.File({
            filename: path.resolve(__dirname, '../../../logs/combined.log'),
            maxFiles: parseInt(process.env.LOG_MAX_FILES ?? '5', 10),
            maxsize: 50 * 1024 * 1024, // 50MB
          }),
        ]
      : []),
  ],
  exceptionHandlers: [
    new transports.File({
      filename: path.resolve(__dirname, '../../../logs/exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new transports.File({
      filename: path.resolve(__dirname, '../../../logs/rejections.log'),
    }),
  ],
};