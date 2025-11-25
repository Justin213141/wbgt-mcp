/**
 * NOAA ISD S3 Fetcher
 * Fetches and decompresses ISD data files from AWS S3
 */

import type { ISDStation } from './types';
import { getStationId } from './types';

export class ISDFetcher {
  private readonly S3_BASE = 'https://noaa-isd-pds.s3.amazonaws.com/data';

  /**
   * Build S3 URL for station and year
   * Example: https://noaa-isd-pds.s3.amazonaws.com/data/2024/947670-99999-2024.gz
   */
  buildS3Url(stationId: string, year: number): string {
    return `${this.S3_BASE}/${year}/${stationId}-${year}.gz`;
  }

  /**
   * Fetch and decompress a single ISD file from S3
   * Uses Cloudflare Workers' native DecompressionStream with robust error handling
   * **PERFORMANCE OPTIMIZATION**: Uses Cloudflare Cache API for S3 responses
   */
  async fetchISDFile(stationId: string, year: number): Promise<string> {
    const url = this.buildS3Url(stationId, year);
    const cacheKey = new Request(url, { method: 'GET' });

    // Try to get from cache first
    let cache: Cache | null = null;
    try {
      cache = caches?.default;
      if (cache) {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          console.log(`[ISD-FETCH] Cache HIT for ${stationId}-${year}`);
          return await cachedResponse.text();
        }
        console.log(`[ISD-FETCH] Cache MISS for ${stationId}-${year}`);
      }
    } catch (e) {
      // Cache API not available (e.g., in development)
      console.warn(`[ISD-FETCH] Cache API not available:`, e);
    }

    console.log(`[ISD-FETCH] Fetching from S3: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`ISD file not found: ${stationId}-${year}`);
        }
        throw new Error(`S3 fetch failed: ${response.status} ${response.statusText}`);
      }

      // Check if response has body
      if (!response.body) {
        throw new Error('Response body is null');
      }

      let result: string;
      try {
        // Method 1: Try direct decompression with Response API
        // Some environments can handle gzip transparently
        const decompressedResponse = new Response(response.body, {
          headers: { 'content-encoding': 'gzip' }
        });
        result = await decompressedResponse.text();
        console.log(`[ISD-FETCH] Successfully decompressed using Response API (${result.length} bytes)`);
      } catch (decompressionError) {
        console.warn(`[ISD-FETCH] Response API decompression failed, trying DecompressionStream:`, decompressionError);

        // Method 2: Use DecompressionStream as fallback
        try {
          const decompressed = response.body.pipeThrough(new DecompressionStream('gzip'));
          const reader = decompressed.getReader();
          const decoder = new TextDecoder();
          result = '';
          let chunks = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });
            chunks++;
          }

          console.log(`[ISD-FETCH] Successfully decompressed ${chunks} chunks using DecompressionStream (${result.length} bytes)`);
        } catch (decompressionStreamError) {
          console.error(`[ISD-FETCH] DecompressionStream also failed:`, decompressionStreamError);
          throw new Error(`Failed to decompress ISD file: ${decompressionStreamError instanceof Error ? decompressionStreamError.message : 'Unknown error'}`);
        }
      }

      // Store in cache for future requests (1 day TTL)
      if (cache) {
        try {
          const cacheResponse = new Response(result, {
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'public, max-age=86400' // 24 hours
            }
          });
          await cache.put(cacheKey, cacheResponse);
          console.log(`[ISD-FETCH] Cached response for ${stationId}-${year}`);
        } catch (e) {
          console.warn(`[ISD-FETCH] Failed to cache response:`, e);
        }
      }

      return result;
    } catch (error) {
      console.error(`[ISD-FETCH] Error fetching ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get list of years covered by a date range
   * Helper method for determining which ISD files to fetch
   */
  getYearsFromDateRange(startDate: string, endDate: string): number[] {
    const startYear = parseInt(startDate.split('-')[0]);
    const endYear = parseInt(endDate.split('-')[0]);

    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    return years;
  }

  /**
   * Fetch ISD data for a date range
   * Handles multiple years if range spans year boundary
   */
  async fetchDateRange(
    station: ISDStation,
    startDate: string,
    endDate: string
  ): Promise<string[]> {
    const stationId = getStationId(station);
    const years = this.getYearsFromDateRange(startDate, endDate);

    const fileContents: string[] = [];

    // Fetch all years in the range
    for (const year of years) {
      try {
        const content = await this.fetchISDFile(stationId, year);
        fileContents.push(content);
      } catch (error) {
        console.error(`[ISD-FETCH] Failed to fetch year ${year}:`, error);
        // Continue with other years even if one fails
      }
    }

    if (fileContents.length === 0) {
      throw new Error(`No ISD data available for ${stationId} in date range ${startDate} to ${endDate}`);
    }

    return fileContents;
  }
}
