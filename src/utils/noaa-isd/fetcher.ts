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
   * Uses Cloudflare Workers' native DecompressionStream
   */
  async fetchISDFile(stationId: string, year: number): Promise<string> {
    const url = this.buildS3Url(stationId, year);
    console.log(`[ISD-FETCH] Fetching ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`ISD file not found: ${stationId}-${year}`);
        }
        throw new Error(`S3 fetch failed: ${response.status} ${response.statusText}`);
      }

      // Decompress using Cloudflare Workers DecompressionStream
      const decompressed = response.body?.pipeThrough(new DecompressionStream('gzip'));

      if (!decompressed) {
        throw new Error('Failed to create decompression stream');
      }

      const reader = decompressed.getReader();
      const decoder = new TextDecoder();
      let result = '';
      let chunks = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        chunks++;
      }

      console.log(`[ISD-FETCH] Successfully decompressed ${chunks} chunks, ${result.length} bytes`);
      return result;
    } catch (error) {
      console.error(`[ISD-FETCH] Error fetching ${url}:`, error);
      throw error;
    }
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
    const startYear = parseInt(startDate.split('-')[0]);
    const endYear = parseInt(endDate.split('-')[0]);

    const fileContents: string[] = [];

    // Fetch all years in the range
    for (let year = startYear; year <= endYear; year++) {
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
