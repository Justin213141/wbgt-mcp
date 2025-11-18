/**
 * Tests for NOAA ISD Fetcher
 *
 * Verifies S3 URL construction and data fetching logic
 */

import { describe, it, expect } from 'vitest';
import { ISDFetcher } from '../fetcher';

describe('NOAA ISD Fetcher', () => {
  const fetcher = new ISDFetcher();

  describe('buildS3Url', () => {
    it('should build correct S3 URL for Sydney Airport 2024', () => {
      const url = fetcher.buildS3Url('947670-99999', 2024);

      expect(url).toBe('https://noaa-isd-pds.s3.amazonaws.com/data/2024/947670-99999-2024.gz');
    });

    it('should build correct S3 URL for Sydney Olympic Park 2023', () => {
      const url = fetcher.buildS3Url('957650-99999', 2023);

      expect(url).toBe('https://noaa-isd-pds.s3.amazonaws.com/data/2023/957650-99999-2023.gz');
    });

    it('should build correct S3 URL for different years', () => {
      const url2020 = fetcher.buildS3Url('947670-99999', 2020);
      const url2021 = fetcher.buildS3Url('947670-99999', 2021);
      const url2022 = fetcher.buildS3Url('947670-99999', 2022);

      expect(url2020).toContain('/2020/');
      expect(url2021).toContain('/2021/');
      expect(url2022).toContain('/2022/');

      expect(url2020).toContain('947670-99999-2020.gz');
      expect(url2021).toContain('947670-99999-2021.gz');
      expect(url2022).toContain('947670-99999-2022.gz');
    });

    it('should handle station IDs with different WBAN', () => {
      const url = fetcher.buildS3Url('723150-03812', 2024);

      expect(url).toBe('https://noaa-isd-pds.s3.amazonaws.com/data/2024/723150-03812-2024.gz');
    });

    it('should build URLs for historical years', () => {
      const url1950 = fetcher.buildS3Url('947670-99999', 1950);
      const url2000 = fetcher.buildS3Url('947670-99999', 2000);

      expect(url1950).toContain('/1950/');
      expect(url2000).toContain('/2000/');
    });

    it('should build URLs for future years', () => {
      const url2025 = fetcher.buildS3Url('947670-99999', 2025);

      expect(url2025).toContain('/2025/');
      expect(url2025).toContain('947670-99999-2025.gz');
    });
  });

  describe('getYearsFromDateRange', () => {
    it('should return single year for dates in same year', () => {
      const years = fetcher.getYearsFromDateRange('2024-07-01', '2024-07-31');

      expect(years).toEqual([2024]);
    });

    it('should return two years for date range spanning year boundary', () => {
      const years = fetcher.getYearsFromDateRange('2023-12-15', '2024-01-15');

      expect(years).toEqual([2023, 2024]);
    });

    it('should return multiple years for multi-year range', () => {
      const years = fetcher.getYearsFromDateRange('2020-06-01', '2023-08-31');

      expect(years).toEqual([2020, 2021, 2022, 2023]);
    });

    it('should handle single-day range', () => {
      const years = fetcher.getYearsFromDateRange('2024-07-15', '2024-07-15');

      expect(years).toEqual([2024]);
    });

    it('should handle year-long range', () => {
      const years = fetcher.getYearsFromDateRange('2024-01-01', '2024-12-31');

      expect(years).toEqual([2024]);
    });

    it('should sort years in ascending order', () => {
      const years = fetcher.getYearsFromDateRange('2020-01-01', '2024-12-31');

      expect(years).toEqual([2020, 2021, 2022, 2023, 2024]);
      expect(years[0]).toBeLessThan(years[years.length - 1]);
    });
  });

  describe('URL Format Validation', () => {
    it('should always produce valid HTTPS URLs', () => {
      const urls = [
        fetcher.buildS3Url('947670-99999', 2024),
        fetcher.buildS3Url('957650-99999', 2023),
        fetcher.buildS3Url('723150-03812', 2022)
      ];

      for (const url of urls) {
        expect(url).toMatch(/^https:\/\//);
      }
    });

    it('should always include S3 domain', () => {
      const urls = [
        fetcher.buildS3Url('947670-99999', 2024),
        fetcher.buildS3Url('957650-99999', 2023)
      ];

      for (const url of urls) {
        expect(url).toContain('noaa-isd-pds.s3.amazonaws.com');
      }
    });

    it('should always include .gz extension', () => {
      const urls = [
        fetcher.buildS3Url('947670-99999', 2024),
        fetcher.buildS3Url('957650-99999', 2023),
        fetcher.buildS3Url('947680-99999', 2022)
      ];

      for (const url of urls) {
        expect(url).toMatch(/\.gz$/);
      }
    });

    it('should follow S3 path pattern /data/YEAR/STATION-YEAR.gz', () => {
      const url = fetcher.buildS3Url('947670-99999', 2024);

      expect(url).toMatch(/\/data\/\d{4}\/\d{6}-\d{5}-\d{4}\.gz$/);
    });
  });

  describe('Station ID Validation', () => {
    it('should handle all Sydney ISD station IDs', () => {
      const sydneyStations = [
        '957650-99999', // Sydney Olympic Park
        '947640-99999', // Parramatta North
        '947660-99999', // Canterbury
        '957560-99999', // Kurnell
        '947650-99999', // Bankstown
        '947680-99999', // Observatory Hill
        '947690-99999', // Fort Denison
        '947800-99999', // Little Bay
        '947670-99999', // Sydney Intl
        '957610-99999', // Holsworthy
        '947600-99999', // Horsley
        '957680-99999'  // North Head
      ];

      for (const stationId of sydneyStations) {
        const url = fetcher.buildS3Url(stationId, 2024);

        expect(url).toContain(stationId);
        expect(url).toContain('2024');
        expect(url).toMatch(/^https:\/\//);
      }
    });

    it('should preserve station ID format exactly', () => {
      const stationId = '947670-99999';
      const url = fetcher.buildS3Url(stationId, 2024);

      expect(url).toContain('947670-99999-2024');
      expect(url).not.toContain('947670-999999'); // No accidental duplication
      expect(url).not.toContain('94767-99999'); // No truncation
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid year gracefully', () => {
      // Should not throw, just build the URL
      const url1 = fetcher.buildS3Url('947670-99999', 0);
      const url2 = fetcher.buildS3Url('947670-99999', -1);
      const url3 = fetcher.buildS3Url('947670-99999', 9999);

      expect(url1).toContain('/0/');
      expect(url2).toContain('/-1/');
      expect(url3).toContain('/9999/');
    });

    it('should handle empty station ID', () => {
      const url = fetcher.buildS3Url('', 2024);

      expect(url).toContain('/2024/');
      expect(url).toContain('-2024.gz');
    });
  });

  describe('Date Range Edge Cases', () => {
    it('should handle reverse date range', () => {
      // End date before start date - should still work
      const years = fetcher.getYearsFromDateRange('2024-12-31', '2024-01-01');

      // Implementation may handle this differently, just verify it doesn't crash
      expect(Array.isArray(years)).toBe(true);
    });

    it('should handle dates with different formats', () => {
      const years1 = fetcher.getYearsFromDateRange('2024-01-01', '2024-12-31');
      const years2 = fetcher.getYearsFromDateRange('2024-1-1', '2024-12-31');

      expect(Array.isArray(years1)).toBe(true);
      expect(Array.isArray(years2)).toBe(true);
    });

    it('should handle very long date ranges', () => {
      const years = fetcher.getYearsFromDateRange('2000-01-01', '2024-12-31');

      expect(years.length).toBe(25); // 2000 through 2024 inclusive
      expect(years[0]).toBe(2000);
      expect(years[years.length - 1]).toBe(2024);
    });
  });

  describe('Integration Scenarios', () => {
    it('should generate correct URLs for typical Sydney Olympic Park query', () => {
      const stationId = '957650-99999'; // Sydney Olympic Park
      const startDate = '2024-07-01';
      const endDate = '2024-07-31';

      const years = fetcher.getYearsFromDateRange(startDate, endDate);
      const urls = years.map(year => fetcher.buildS3Url(stationId, year));

      expect(urls).toHaveLength(1);
      expect(urls[0]).toBe('https://noaa-isd-pds.s3.amazonaws.com/data/2024/957650-99999-2024.gz');
    });

    it('should generate correct URLs for cross-year query', () => {
      const stationId = '947670-99999'; // Sydney Intl
      const startDate = '2023-12-15';
      const endDate = '2024-01-15';

      const years = fetcher.getYearsFromDateRange(startDate, endDate);
      const urls = years.map(year => fetcher.buildS3Url(stationId, year));

      expect(urls).toHaveLength(2);
      expect(urls[0]).toContain('/2023/');
      expect(urls[1]).toContain('/2024/');
    });

    it('should generate correct URLs for multi-year historical analysis', () => {
      const stationId = '947680-99999'; // Observatory Hill (oldest station)
      const startDate = '2020-01-01';
      const endDate = '2024-12-31';

      const years = fetcher.getYearsFromDateRange(startDate, endDate);
      const urls = years.map(year => fetcher.buildS3Url(stationId, year));

      expect(urls).toHaveLength(5);
      expect(urls).toContain('https://noaa-isd-pds.s3.amazonaws.com/data/2020/947680-99999-2020.gz');
      expect(urls).toContain('https://noaa-isd-pds.s3.amazonaws.com/data/2024/947680-99999-2024.gz');
    });
  });
});
