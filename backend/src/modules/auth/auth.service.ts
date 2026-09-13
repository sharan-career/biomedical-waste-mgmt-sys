import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { parseDurationMs } from '../../common/utils/duration.util';
import { JwtAccessPayload } from './types/jwt-payload.type';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
    ip?: string,
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    // Same generic error whether the email doesn't exist or the password is wrong —
    // never reveal which one it was.
    const invalidCredentials = () =>
      new UnauthorizedException('Invalid email or password');

    if (!user || user.deletedAt) {
      throw invalidCredentials();
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('This account is inactive');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      await this.auditService.record(this.prisma, {
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
      });
      throw invalidCredentials();
    }

    const roles = user.roles.map((ur) => ur.role.name);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.auditService.record(this.prisma, {
      userId: user.id,
      action: 'LOGIN_SUCCEEDED',
      entityType: 'User',
      entityId: user.id,
    });

    return this.issueTokenPair(user.id, user.email, roles, ip);
  }

  async refresh(rawRefreshToken: string, ip?: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.revokedAt) {
      // Reuse of an already-rotated (or logged-out) refresh token — treat as a
      // possible theft and revoke the entire session family for this user.
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Refresh token has already been used; please log in again',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const roles = stored.user.roles.map((ur) => ur.role.name);
    return this.issueTokenPair(stored.user.id, stored.user.email, roles, ip);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    roles: JwtAccessPayload['roles'],
    ip?: string,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: userId, email, roles } satisfies JwtAccessPayload,
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN'),
      },
    );

    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
    const expiresAt = new Date(Date.now() + parseDurationMs(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt,
        createdByIp: ip,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
