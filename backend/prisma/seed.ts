import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES: { name: RoleName; description: string }[] = [
  { name: 'SUPER_ADMIN', description: 'Full access to everything' },
  { name: 'ACCOUNTS_MANAGER', description: 'Manages invoices, payments, follow-up assignment' },
  { name: 'COLLECTION_EXECUTIVE', description: 'Works assigned follow-ups; cannot edit financials' },
  { name: 'MANAGEMENT', description: 'Read-only dashboards and reports' },
];

// The 4 Talukas the company currently operates in (see prompts/business-docs/ALL MOU.xlsx).
// Route assignment within each Taluka is seeded in Phase 2 alongside customer import.
const TALUKAS = ['Kalaburagi', 'Jewargi', 'Sedam', 'Chittapur'];

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log(`Seeded ${ROLES.length} roles.`);

  for (const name of TALUKAS) {
    await prisma.taluka.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${TALUKAS.length} talukas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
