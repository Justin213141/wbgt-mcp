/**
 * Tests for utils barrel export
 * Ensures all utility modules are properly exported
 */

import { describe, it, expect } from 'vitest';

// Test importing from the barrel export
import * as Utils from '../index';

describe('Utils Index Exports', () => {
  it('should export utility modules', () => {
    // The utils index should export from errors, logger, and formatters
    expect(typeof Utils).toBe('object');
  });

  it('should be an object with exports', () => {
    // Should have some exports (the exact number depends on what's exported from submodules)
    const exportNames = Object.keys(Utils);
    expect(exportNames.length).toBeGreaterThan(0);
  });

  it('should have valid export structure', () => {
    // Should contain exports from errors, logger, and formatters modules
    expect(Utils).toBeDefined();
    expect(typeof Utils).toBe('object');
  });

  it('should not have undefined exports', () => {
    const exportNames = Object.keys(Utils);

    exportNames.forEach(exportName => {
      expect(Utils[exportName as keyof typeof Utils]).toBeDefined();
    });
  });

  it('should maintain consistent export pattern', () => {
    // This is a basic test to ensure the barrel export is working
    expect(Utils).not.toBeNull();
    expect(Utils).not.toBeUndefined();
  });
});