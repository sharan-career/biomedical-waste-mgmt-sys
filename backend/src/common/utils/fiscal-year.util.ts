/** Indian fiscal year runs Apr–Mar. Returns e.g. "26-27" for any date in Apr 2026–Mar 2027. */
export function getFiscalYearLabel(date: Date): string {
  const year = date.getFullYear();
  const isBeforeApril = date.getMonth() < 3; // getMonth() is 0-indexed; 3 = April
  const startYear = isBeforeApril ? year - 1 : year;
  const shortStart = startYear % 100;
  const shortEnd = (startYear + 1) % 100;
  return `${String(shortStart).padStart(2, '0')}-${String(shortEnd).padStart(2, '0')}`;
}
