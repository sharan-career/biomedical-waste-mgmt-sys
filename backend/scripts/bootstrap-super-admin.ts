/**
 * One-time manual script to create the first Super Admin. Run with `npm run bootstrap`
 * after migrations + seed have been applied. NEVER exposed as an API route — public
 * self-signup does not exist in this system; every subsequent user is created by a
 * Super Admin via POST /api/v1/users.
 *
 * Usage: BOOTSTRAP_EMAIL=admin@company.com BOOTSTRAP_PASSWORD=... npm run bootstrap
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.BOOTSTRAP_EMAIL;
  const password = process.env.BOOTSTRAP_PASSWORD;
  const fullName = process.env.BOOTSTRAP_FULL_NAME ?? 'Super Admin';

  if (!email || !password) {
    throw new Error('Set BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD environment variables first.');
  }
  if (password.length < 8) {
    throw new Error('BOOTSTRAP_PASSWORD must be at least 8 characters.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`A user with email ${email} already exists — nothing to do.`);
  }

  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  if (!superAdminRole) {
    throw new Error('SUPER_ADMIN role not found — run `npx prisma db seed` first.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      roles: { create: [{ roleId: superAdminRole.id }] },
    },
  });

  console.log(`Super Admin created: ${user.email} (id: ${user.id})`);
  console.log('Share the password with the admin out of band, then delete it from your shell history.');
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
