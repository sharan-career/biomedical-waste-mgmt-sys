import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let auditService: { record: jest.Mock };

  const baseUser = {
    id: 'user-1',
    email: 'admin@company.com',
    passwordHash: 'hashed',
    status: 'ACTIVE',
    deletedAt: null,
    roles: [{ role: { name: 'SUPER_ADMIN' } }],
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    auditService = { record: jest.fn() };

    const jwtService = {
      sign: jest.fn().mockReturnValue('signed-access-token'),
    };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'secret',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return values[key] ?? fallback;
      }),
    };

    authService = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      auditService as unknown as AuditService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('returns a token pair and records LOGIN_SUCCEEDED on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(baseUser);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.login(
        'admin@company.com',
        'correct-password',
      );

      expect(result.accessToken).toBe('signed-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'LOGIN_SUCCEEDED',
          userId: baseUser.id,
        }),
      );
    });

    it('rejects an unknown email without revealing that the account does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login('nobody@company.com', 'whatever'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password and records LOGIN_FAILED', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login('admin@company.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
      expect(auditService.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'LOGIN_FAILED',
          userId: baseUser.id,
        }),
      );
    });

    it('rejects an inactive account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        status: 'INACTIVE',
      });

      await expect(
        authService.login('admin@company.com', 'correct-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const storedToken = {
      id: 'rt-1',
      userId: baseUser.id,
      revokedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60_000),
      user: baseUser,
    };

    it('rotates a valid, unexpired refresh token', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(storedToken);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.refresh('some-raw-token');

      expect(result.accessToken).toBe('signed-access-token');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' } }),
      );
    });

    it('rejects an unknown refresh token', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue(null);
      await expect(authService.refresh('bogus-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('detects reuse of an already-revoked token and revokes the whole session family', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        ...storedToken,
        revokedAt: new Date(),
      });

      await expect(authService.refresh('reused-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: baseUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findFirst.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(authService.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
