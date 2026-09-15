/**
 * One-time (but safely re-runnable) import of the real customer base from the business's
 * existing `ALL MOU.xlsx` (see data/ in the repo root — gitignored, contains real customer
 * PII/business data). Only touches Taluka/Route/Customer/CustomerContact — never
 * Contracts/Invoices/Payments/FollowUps, so re-running after fixing a data issue is safe.
 *
 * Usage: npm run import:customers -- --file="../data/ALL MOU (1).xlsx"
 * (defaults to that path if --file is omitted)
 */
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const SHEET_TO_TALUKA: Record<string, string> = {
  KALABURAGI: 'Kalaburagi',
  JEWARGI: 'Jewargi',
  SEDAM: 'Sedam',
  CHITAPUR: 'Chittapur',
};

const TALUKA_PREFIX: Record<string, string> = {
  Kalaburagi: 'KLB',
  Jewargi: 'JWG',
  Sedam: 'SDM',
  Chittapur: 'CHP',
};

const FACILITY_MAP: Record<string, 'BEDDED_HOSPITAL' | 'CLINIC' | 'DENTAL_CLINIC' | 'LAB' | 'OTHER'> = {
  bedded: 'BEDDED_HOSPITAL',
  clinic: 'CLINIC',
  dc: 'DENTAL_CLINIC',
  lab: 'LAB',
  hwc: 'OTHER',
  sc: 'OTHER',
  mc: 'OTHER',
};

interface SourceRow {
  name: string;
  locality: string | null;
  address: string | null;
  drName: string | null;
  phone: string | null;
  pincode: string | null;
  email: string | null;
  routeNumber: number | null;
  facility: string | null;
  bedCount: number | null;
}

function cell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function looksLikeEmail(value: string | null): string | null {
  return value && value.includes('@') ? value : null;
}

function parseSheet(sheet: XLSX.WorkSheet): SourceRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const dataRows = rows.slice(1); // row 0 is the header row
  const parsed: SourceRow[] = [];

  for (const row of dataRows) {
    const name = cell(row[1]);
    if (!name) continue; // blank separator rows etc.

    const routeRaw = cell(row[8]);
    parsed.push({
      name,
      locality: cell(row[2]),
      address: cell(row[3]),
      drName: cell(row[4]),
      phone: cell(row[5]),
      pincode: cell(row[6]),
      email: looksLikeEmail(cell(row[7])),
      routeNumber: routeRaw ? Number(routeRaw) : null,
      facility: cell(row[9]),
      bedCount: row[10] ? Number(row[10]) : null,
    });
  }
  return parsed;
}

function mapFacilityType(facility: string | null) {
  if (!facility) return 'OTHER' as const;
  return FACILITY_MAP[facility.toLowerCase()] ?? ('OTHER' as const);
}

async function maxExistingSequence(prefix: string): Promise<number> {
  const existing = await prisma.customer.findMany({
    where: { customerCode: { startsWith: `${prefix}-` } },
    select: { customerCode: true },
  });
  let max = 0;
  for (const { customerCode } of existing) {
    const n = Number(customerCode.split('-')[1]);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return max;
}

function makeCodeGenerator(prefix: string, startingSequence: number) {
  let next = startingSequence + 1;
  return () => {
    const code = `${prefix}-${String(next).padStart(4, '0')}`;
    next += 1;
    return code;
  };
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1];
  const dryRun = process.argv.includes('--dry-run');
  const filePath = path.resolve(__dirname, fileArg ?? '../../data/ALL MOU (1).xlsx');

  console.log(`Reading ${filePath}${dryRun ? ' (dry run — no writes)' : ''}`);
  const workbook = XLSX.readFile(filePath);

  if (dryRun) {
    let total = 0;
    for (const sheetName of Object.keys(SHEET_TO_TALUKA)) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows = parseSheet(sheet);
      total += rows.length;
      const sample = rows[0];
      console.log(`${sheetName}: ${rows.length} rows. First row:`, sample);
    }
    console.log(`\nTotal parsed rows across all sheets: ${total}`);
    return;
  }

  let created = 0;
  let skippedDuplicate = 0;
  let missingEmail = 0;
  let missingPhone = 0;
  const duplicateWarnings: string[] = [];

  for (const [sheetName, talukaName] of Object.entries(SHEET_TO_TALUKA)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.warn(`Sheet "${sheetName}" not found, skipping.`);
      continue;
    }

    const taluka = await prisma.taluka.upsert({
      where: { name: talukaName },
      update: {},
      create: { name: talukaName },
    });

    const rows = parseSheet(sheet);
    console.log(`\n${sheetName} -> Taluka "${talukaName}": ${rows.length} rows`);

    const routeCache = new Map<number, string>();
    const prefix = TALUKA_PREFIX[talukaName];
    const generateCode = makeCodeGenerator(prefix, await maxExistingSequence(prefix));

    for (const row of rows) {
      const existingCustomer = await prisma.customer.findFirst({
        where: { talukaId: taluka.id, organizationName: { equals: row.name, mode: 'insensitive' } },
      });
      if (existingCustomer) {
        skippedDuplicate += 1;
        duplicateWarnings.push(`${row.name} (${talukaName}) — already imported, skipped`);
        continue;
      }

      let routeId: string | undefined;
      if (row.routeNumber) {
        if (!routeCache.has(row.routeNumber)) {
          const route = await prisma.route.upsert({
            where: { talukaId_routeNumber: { talukaId: taluka.id, routeNumber: row.routeNumber } },
            update: {},
            create: { talukaId: taluka.id, routeNumber: row.routeNumber },
          });
          routeCache.set(row.routeNumber, route.id);
        }
        routeId = routeCache.get(row.routeNumber);
      }

      if (!row.email) missingEmail += 1;
      if (!row.phone) missingPhone += 1;

      const facilityType = mapFacilityType(row.facility);
      const customerCode = generateCode();

      await prisma.customer.create({
        data: {
          customerCode,
          organizationName: row.name,
          customerType: 'PRIVATE', // Government HCEs are tracked/billed separately — see BUSINESS_REQUIREMENTS.md open question #2
          facilityType,
          bedCount: facilityType === 'BEDDED_HOSPITAL' ? row.bedCount : null,
          talukaId: taluka.id,
          routeId,
          address: row.address ?? row.locality ?? talukaName,
          city: row.locality ?? talukaName,
          state: 'Karnataka',
          pincode: row.pincode ?? '000000',
          contacts: row.drName
            ? { create: [{ contactType: 'PRIMARY', name: row.drName, phone: row.phone, email: row.email }] }
            : undefined,
        },
      });
      created += 1;
    }
  }

  console.log('\n--- Import summary ---');
  console.log(`Created: ${created}`);
  console.log(`Skipped (already imported): ${skippedDuplicate}`);
  console.log(`Missing email: ${missingEmail}, missing phone: ${missingPhone} (imported anyway, nullable fields)`);
  if (duplicateWarnings.length > 0 && duplicateWarnings.length <= 20) {
    console.log('\nSkipped duplicates:');
    duplicateWarnings.forEach((w) => console.log(`  - ${w}`));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
