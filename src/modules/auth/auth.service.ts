import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { usersRepository } from '../users/users.repository';
import { refreshTokenRepository } from './refreshToken.repository';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../auth/tokens';
import { permissionsForRole } from '../../auth/rbac';
import { Unauthorized } from '../../utils/errors';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const REFRESH_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

interface AuthContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

export const authService = {
  async login(email: string, password: string, ctx: AuthContext) {
    const user = await usersRepository.findByEmail(email);
    if (!user || !user.is_active) {
      // Same message for both cases to avoid user enumeration
      throw Unauthorized('Invalid credentials');
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw Unauthorized('Invalid credentials');

    await usersRepository.touchLogin(user.id);
    return this.issueTokens(user, ctx);
  },

  async issueTokens(
    user: { id: string; email: string; full_name: string; role: any },
    ctx: AuthContext
  ) {
    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.full_name,
    });

    const jti = uuid();
    const refreshToken = signRefreshToken({ sub: user.id, jti });
    await refreshTokenRepository.store({
      userId: user.id,
      jti,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
        permissions: permissionsForRole(user.role),
      },
    };
  },

  /** Rotate a refresh token. Detects reuse of already-rotated tokens. */
  async refresh(token: string, ctx: AuthContext) {
    let payload: { sub: string; jti: string };
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw Unauthorized('Invalid or expired refresh token');
    }

    const stored = await refreshTokenRepository.findByJti(payload.jti);
    if (!stored) throw Unauthorized('Refresh token not recognized');

    // Reuse detection: a revoked token presented again => compromise. Kill the family.
    if (stored.revoked_at) {
      logger.warn({ userId: stored.user_id, jti: payload.jti }, 'Refresh token reuse detected');
      await refreshTokenRepository.revokeAllForUser(stored.user_id);
      throw Unauthorized('Refresh token has been revoked');
    }

    if (hashToken(token) !== stored.token_hash) {
      throw Unauthorized('Refresh token mismatch');
    }

    const user = await usersRepository.findById(payload.sub);
    if (!user || !user.is_active) throw Unauthorized('Account is inactive');

    // Issue new pair and mark the old one rotated
    const result = await this.issueTokens(user, ctx);
    const newPayload = verifyRefreshToken(result.refreshToken);
    await refreshTokenRepository.revoke(payload.jti, newPayload.jti);
    return result;
  },

  async logout(token: string) {
    try {
      const payload = verifyRefreshToken(token);
      await refreshTokenRepository.revoke(payload.jti);
    } catch {
      // ignore - logout should be idempotent
    }
  },

  async logoutAll(userId: string) {
    await refreshTokenRepository.revokeAllForUser(userId);
  },

  async me(userId: string) {
    const user = await usersRepository.findPublicById(userId);
    if (!user) throw Unauthorized('Account not found');
    return {
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
      phone: user.phone,
      permissions: permissionsForRole(user.role),
    };
  },

  // exposed for tests / diagnostics
  _ttl: env.jwtRefreshTtl,
};
