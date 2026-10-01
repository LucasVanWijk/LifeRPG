import { describe, expect, it } from 'vitest';
import { driveHasNewer } from './drive';

const remote = { id: 'f1', modifiedTime: '2026-10-01T10:00:00.000Z' };

describe('driveHasNewer', () => {
  it('warns when this browser never synced, or synced a different file or an older version', () => {
    expect(driveHasNewer(remote, null)).toBe(true);
    expect(driveHasNewer(remote, { id: 'other', modifiedTime: remote.modifiedTime, at: '' })).toBe(true);
    expect(driveHasNewer(remote, { ...remote, modifiedTime: '2026-09-30T10:00:00.000Z', at: '' })).toBe(true);
  });
  it('is quiet when the Drive file is the one this browser last synced', () => {
    expect(driveHasNewer(remote, { ...remote, at: '2026-10-01T10:00:01.000Z' })).toBe(false);
  });
});
