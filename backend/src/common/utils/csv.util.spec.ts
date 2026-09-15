import { toCsv } from './csv.util';

describe('toCsv', () => {
  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('builds a header from the first row and one line per row', () => {
    const csv = toCsv([
      { name: 'Aditi Hospital', amount: '5400' },
      { name: 'Sai Sharan Lab', amount: '600' },
    ]);
    expect(csv).toBe('name,amount\nAditi Hospital,5400\nSai Sharan Lab,600');
  });

  it('quotes and escapes values containing commas, quotes, or newlines', () => {
    const csv = toCsv([{ name: 'Say "Hi", please', note: 'line1\nline2' }]);
    expect(csv).toBe('name,note\n"Say ""Hi"", please","line1\nline2"');
  });

  it('renders null/undefined as an empty cell', () => {
    const csv = toCsv([{ name: 'X', note: null }]);
    expect(csv).toBe('name,note\nX,');
  });
});
