function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Builds a CSV string from an array of flat objects. Column order follows the first row's keys. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const header = columns.join(',');
  const lines = rows.map((row) =>
    columns.map((col) => escapeCsvValue(row[col])).join(','),
  );
  return [header, ...lines].join('\n');
}
