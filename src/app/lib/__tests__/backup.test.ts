import { describe, expect, it } from 'vitest';
import { backupProblem } from '../backup';

describe('backupProblem', () => {
  const current = { format: 'nanothumbnail-backup', version: 2 };

  it('accepts a backup of the current format', () => {
    expect(backupProblem(current)).toBeNull();
  });

  it('refuses a backup from before the simple history', () => {
    expect(backupProblem({ ...current, version: 1 })).toBe('old');
  });

  it('refuses a backup from a later version, which it cannot read either', () => {
    expect(backupProblem({ ...current, version: 3 })).toBe('old');
  });

  it('refuses what is not a backup', () => {
    expect(backupProblem({ format: 'other', version: 2 })).toBe('unknown');
    expect(backupProblem(null)).toBe('unknown');
    expect(backupProblem('x')).toBe('unknown');
  });
});
