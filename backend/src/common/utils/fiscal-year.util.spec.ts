import { getFiscalYearLabel } from './fiscal-year.util';

describe('getFiscalYearLabel', () => {
  it('returns the current FY for a date in the second half (Jan-Mar)', () => {
    expect(getFiscalYearLabel(new Date('2026-01-15'))).toBe('25-26');
  });

  it('returns the current FY for a date in the first half (Apr-Dec)', () => {
    expect(getFiscalYearLabel(new Date('2026-08-31'))).toBe('26-27');
  });

  it('treats April 1st as the start of the fiscal year', () => {
    expect(getFiscalYearLabel(new Date('2026-04-01'))).toBe('26-27');
    expect(getFiscalYearLabel(new Date('2026-03-31'))).toBe('25-26');
  });
});
