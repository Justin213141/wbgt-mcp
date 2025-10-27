/**
 * Tests for constants index file to ensure coverage
 * Simple tests to verify the barrel export works
 */

import { describe, it, expect } from 'vitest';

// Test importing from the constants barrel export
import * as Constants from '../index';

describe('Constants Index Coverage', () => {
  it('should export constants object', () => {
    expect(typeof Constants).toBe('object');
  });

  it('should have multiple exports', () => {
    const exportCount = Object.keys(Constants).length;
    expect(exportCount).toBeGreaterThan(5);
  });

  it('should export expected constant categories', () => {
    // Should have physical constants, WBGT constants, locations, etc.
    const hasPhysicalConstants = Object.keys(Constants).some(key =>
      key.includes('STEFAN') || key.includes('GAS_CONSTANT')
    );
    const hasWBGTConstants = Object.keys(Constants).some(key =>
      key.includes('GLOBE') || key.includes('WICK')
    );
    const hasLocationConstants = Object.keys(Constants).some(key =>
      key.includes('LOCATION') || key.includes('SYDNEY')
    );

    expect(hasPhysicalConstants).toBe(true);
    expect(hasWBGTConstants).toBe(true);
    expect(hasLocationConstants).toBe(true);
  });
});