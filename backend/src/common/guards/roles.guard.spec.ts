import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function buildContext(
  user: { roles: RoleName[] } | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  function buildGuard(requiredRoles: RoleName[] | undefined) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('allows access when the route has no @Roles() restriction', () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(buildContext({ roles: [] }))).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const guard = buildGuard([RoleName.SUPER_ADMIN, RoleName.ACCOUNTS_MANAGER]);
    expect(
      guard.canActivate(buildContext({ roles: [RoleName.ACCOUNTS_MANAGER] })),
    ).toBe(true);
  });

  it('throws ForbiddenException when the user lacks every required role', () => {
    const guard = buildGuard([RoleName.SUPER_ADMIN]);
    expect(() =>
      guard.canActivate(
        buildContext({ roles: [RoleName.COLLECTION_EXECUTIVE] }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('denies access when there is no authenticated user at all', () => {
    const guard = buildGuard([RoleName.SUPER_ADMIN]);
    expect(guard.canActivate(buildContext(undefined))).toBe(false);
  });
});
