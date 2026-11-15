import { ConfigService } from '@nestjs/config';

export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret) return secret;
  const nodeEnv = config.get<string>('NODE_ENV') || process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET bắt buộc trong production');
  }
  return 'edupoint-local-development-only';
}
