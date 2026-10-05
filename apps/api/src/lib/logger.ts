// Structured JSON logging for log aggregation (CloudWatch, Datadog, etc.)
// Using console directly to avoid introducing a dependency like winston/pino
// for a relatively small surface area.
export const logger = {
  info: (msg: string, meta?: any) => console.log(JSON.stringify({ level: 'info', msg, ...meta })),
  warn: (msg: string, meta?: any) => console.warn(JSON.stringify({ level: 'warn', msg, ...meta })),
  error: (msg: string, meta?: any) => console.error(JSON.stringify({ level: 'error', msg, ...meta }))
};
