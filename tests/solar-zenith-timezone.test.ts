import { describe, it, expect } from 'vitest';
import { calculateSolarZenithAngle, calculateSolarZenithAngleByTimezone } from '../src/calculations';

describe('Solar Zenith - Timezone Unified Function', () => {
  it('should calculate valid solar zenith angle for Sydney', () => {
    const lat = -33.8018;
    const lon = 151.1254;
    const timestamp = '2025-10-11T08:00';

    const result = calculateSolarZenithAngle(lat, lon, timestamp);

    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(180);
  });

  it('should have unified timezone function that works for any UTC offset', () => {
    const lat = -33.8018;
    const lon = 151.1254;
    const timestamp = '2025-10-11T08:00';

    // Should use calculateSolarZenithAngleByTimezone with Sydney offset
    const result = calculateSolarZenithAngleByTimezone(lat, lon, timestamp, 10, true);

    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(180);
  });
});
