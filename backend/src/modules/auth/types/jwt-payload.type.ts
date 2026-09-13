import { RoleName } from '@prisma/client';

/** Shape encoded inside the access token. */
export interface JwtAccessPayload {
  sub: string; // user id
  email: string;
  roles: RoleName[];
}

/** Shape Passport attaches to `request.user` after JwtStrategy.validate(). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: RoleName[];
}
