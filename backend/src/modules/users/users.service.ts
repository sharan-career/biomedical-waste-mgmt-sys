import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

function toSafeUser<T extends { passwordHash: string }>(
  user: T,
): Omit<T, 'passwordHash'> {
  const safe: Partial<T> = { ...user };
  delete safe.passwordHash;
  return safe as Omit<T, 'passwordHash'>;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const created = await this.prisma.$transaction(async (tx) => {
      const roles = await tx.role.findMany({
        where: { name: { in: dto.roles } },
      });
      if (roles.length !== dto.roles.length) {
        throw new NotFoundException('One or more roles do not exist');
      }

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          createdBy: actorUserId,
          updatedBy: actorUserId,
          roles: {
            create: roles.map((role) => ({ roleId: role.id })),
          },
        },
        include: { roles: { include: { role: true } } },
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        newValue: {
          email: user.email,
          fullName: user.fullName,
          roles: dto.roles,
        },
      });

      return user;
    });

    return toSafeUser(created);
  }

  async findAll(query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => toSafeUser(u)),
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  async findOneOrThrow(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toSafeUser(user);
  }

  /** Used by GET /users/me — profile plus the permission-relevant role list for the frontend. */
  async getProfile(userId: string) {
    const user = await this.findOneOrThrow(userId);
    return { ...user, roles: user.roles.map((r) => r.role.name) };
  }

  async update(id: string, dto: UpdateUserDto, actorUserId: string) {
    await this.findOneOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id } });
      const updated = await tx.user.update({
        where: { id },
        data: { ...dto, updatedBy: actorUserId },
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'USER_UPDATED',
        entityType: 'User',
        entityId: id,
        previousValue: { fullName: before.fullName, phone: before.phone },
        newValue: { fullName: updated.fullName, phone: updated.phone },
      });

      return toSafeUser(updated);
    });
  }

  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
    actorUserId: string,
  ) {
    await this.findOneOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id } });
      const updated = await tx.user.update({
        where: { id },
        data: { status, updatedBy: actorUserId },
      });

      if (status === 'INACTIVE') {
        // Prevents a still-valid refresh token from minting new access tokens
        // for a deactivated account.
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'USER_STATUS_CHANGED',
        entityType: 'User',
        entityId: id,
        previousValue: { status: before.status },
        newValue: { status: updated.status },
      });

      return toSafeUser(updated);
    });
  }

  async updateRoles(id: string, roleNames: RoleName[], actorUserId: string) {
    await this.findOneOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const roles = await tx.role.findMany({
        where: { name: { in: roleNames } },
      });
      if (roles.length !== roleNames.length) {
        throw new NotFoundException('One or more roles do not exist');
      }

      const before = await tx.userRole.findMany({
        where: { userId: id },
        include: { role: true },
      });

      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({ userId: id, roleId: role.id })),
      });

      await this.auditService.record(tx, {
        userId: actorUserId,
        action: 'USER_ROLES_CHANGED',
        entityType: 'User',
        entityId: id,
        previousValue: { roles: before.map((b) => b.role.name) },
        newValue: { roles: roleNames },
      });

      const updated = await tx.user.findUniqueOrThrow({
        where: { id },
        include: { roles: { include: { role: true } } },
      });
      return toSafeUser(updated);
    });
  }
}
