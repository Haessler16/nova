import type { ConfigService } from '@nestjs/config';
import type { Logger } from '@nestjs/common';
import type { IssuedAuthToken } from './auth-token.service';
import type { IssuedTokenResponse } from './auth.service.support';

export interface TokenDeliveryPolicy {
  nodeEnv: string;
  delivery: 'log' | 'response' | 'none';
}

export function tokenDeliveryPolicy(config: ConfigService): TokenDeliveryPolicy {
  return {
    nodeEnv: config.get<string>('NODE_ENV', 'development'),
    delivery: config.get<'log' | 'response' | 'none'>('AUTH_TOKEN_DELIVERY', 'log'),
  };
}

/**
 * Password reset and verification tokens are never returned in production:
 * they go to the log in development, or nowhere when no email provider exists.
 */
export function deliverIssuedToken(
  policy: TokenDeliveryPolicy,
  logger: Logger,
  issued: IssuedAuthToken,
  purpose: string,
): IssuedTokenResponse {
  const response: IssuedTokenResponse = { expiresAt: issued.expiresAt.toISOString() };

  if (policy.nodeEnv !== 'production' && policy.delivery === 'response') {
    return { ...response, token: issued.token };
  }

  if (policy.nodeEnv !== 'production' && policy.delivery === 'log') {
    logger.warn(
      `Development-only ${purpose} token (expires ${issued.expiresAt.toISOString()}): ${issued.token}`,
    );
  } else if (policy.delivery === 'none') {
    logger.warn(
      `${purpose} token generated but AUTH_TOKEN_DELIVERY=none; no email provider is configured.`,
    );
  }

  return response;
}
