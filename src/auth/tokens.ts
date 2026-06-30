import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from './rbac';

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  email: string;
  name: string;
}

export interface RefreshTokenPayload {
  sub: string;
  // token family id used for rotation/reuse detection
  jti: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessTtl,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshTtl,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
}
