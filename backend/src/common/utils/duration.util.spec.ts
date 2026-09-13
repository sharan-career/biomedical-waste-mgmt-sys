import { parseDurationMs } from './duration.util';

describe('parseDurationMs', () => {
  it('parses seconds', () => {
    expect(parseDurationMs('30s')).toBe(30 * 1000);
  });

  it('parses minutes', () => {
    expect(parseDurationMs('15m')).toBe(15 * 60 * 1000);
  });

  it('parses hours', () => {
    expect(parseDurationMs('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('parses days', () => {
    expect(parseDurationMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDurationMs('7 days')).toThrow(/Invalid duration string/);
    expect(() => parseDurationMs('7')).toThrow(/Invalid duration string/);
    expect(() => parseDurationMs('7x')).toThrow(/Invalid duration string/);
  });
});
