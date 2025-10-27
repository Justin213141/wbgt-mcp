import { describe, it, expect } from 'vitest';
import { HistoricalFetcher } from '../src/utils/historical-fetcher';

describe('HistoricalFetcher - Phase 2 Consolidation', () => {
  it('should have fetchKongWBGTByTimezone method', () => {
    const fetcher = new HistoricalFetcher();
    expect(typeof fetcher.fetchKongWBGTByTimezone).toBe('function');
  });
});
