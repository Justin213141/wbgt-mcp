/**
 * WeatherZone Observations Fetcher
 *
 * Fetches historical weather observations from WeatherZone using Cloudflare Browser Rendering.
 * Uses Puppeteer to render JavaScript and extract observation data.
 *
 * IMPORTANT NOTE: WeatherZone API quirk with wind units
 * - The wind field in WeatherZone HTML is labeled as 'wind_kmh'
 * - However, the actual values are already in m/s (meters per second)
 * - NO CONVERSION IS NEEDED - values are used as-is
 * - This applies to all wind speed data extracted from WeatherZone
 */

import puppeteer from '@cloudflare/puppeteer';

export interface WeatherZoneObservation {
  time: string; // ISO datetime
  temperature_c: number;
  humidity_pct?: number;
  dewpoint_c?: number;
  wind_speed_ms?: number; // NOTE: WeatherZone labels this as 'wind_kmh' but values are already in m/s
}

export type WeatherZoneErrorType =
  | 'browser_unavailable'
  | 'browser_launch_failed'
  | 'rate_limit_exceeded'
  | 'navigation_timeout'
  | 'navigation_failed'
  | 'page_load_error'
  | 'no_data_found'
  | 'parsing_error'
  | 'unknown_error';

export interface WeatherZoneErrorDetails {
  type: WeatherZoneErrorType;
  message: string;
  httpStatus?: number;
  retryAfter?: number; // seconds
  originalError?: string;
}

export interface WeatherZoneFetchResult {
  success: boolean;
  observations: WeatherZoneObservation[];
  cached?: boolean;
  source: 'weatherzone' | 'cache' | 'error';
  error?: string;
  errorDetails?: WeatherZoneErrorDetails;
  site_id?: string;
  date?: string;
}

/**
 * Build WeatherZone station observations URL
 */
export function buildWeatherZoneURL(siteId: string, observationDate: string): string {
  // Format: https://www.weatherzone.com.au/station/SITE/{site_id}/observations/{date}
  // Date format: YYYY-MM-DD
  return `https://www.weatherzone.com.au/station/SITE/${siteId}/observations/${observationDate}`;
}

/**
 * Fetch WeatherZone observations using Puppeteer and Browser Rendering
 *
 * Launches a headless browser, navigates to WeatherZone, waits for data to load,
 * and extracts observations from the rendered DOM.
 */
export async function fetchWeatherZoneObservations(
  siteId: string,
  observationDate: string,
  browserBinding?: any
): Promise<WeatherZoneFetchResult> {
  const url = buildWeatherZoneURL(siteId, observationDate);

  // Require browser binding
  if (!browserBinding) {
    const errorDetails: WeatherZoneErrorDetails = {
      type: 'browser_unavailable',
      message: 'Browser rendering not available. BROWSER binding is not configured in wrangler.jsonc.'
    };
    console.error(`[WEATHERZONE] ${errorDetails.message}`);
    return {
      success: false,
      observations: [],
      source: 'error',
      error: errorDetails.message,
      errorDetails,
      site_id: siteId,
      date: observationDate
    };
  }

  let browser;
  let httpStatus: number | undefined;

  try {
    console.log(`[WEATHERZONE] Launching browser for ${url}`);

    // Launch browser using Puppeteer
    try {
      browser = await puppeteer.launch(browserBinding);
    } catch (launchError: any) {
      // Detect rate limit errors from Cloudflare Browser Rendering
      if (launchError.message?.includes('429') || launchError.message?.toLowerCase().includes('rate limit')) {
        const errorDetails: WeatherZoneErrorDetails = {
          type: 'rate_limit_exceeded',
          message: 'Cloudflare Browser Rendering rate limit exceeded (3 launches/minute or 10 minutes/day)',
          httpStatus: 429,
          retryAfter: 60,
          originalError: launchError.message
        };
        console.error(`[WEATHERZONE] ${errorDetails.message}`, launchError);
        return {
          success: false,
          observations: [],
          source: 'error',
          error: errorDetails.message,
          errorDetails,
          site_id: siteId,
          date: observationDate
        };
      }

      // Generic browser launch failure
      const errorDetails: WeatherZoneErrorDetails = {
        type: 'browser_launch_failed',
        message: 'Failed to launch browser for rendering',
        originalError: launchError.message
      };
      console.error(`[WEATHERZONE] ${errorDetails.message}`, launchError);
      return {
        success: false,
        observations: [],
        source: 'error',
        error: errorDetails.message,
        errorDetails,
        site_id: siteId,
        date: observationDate
      };
    }

    const page = await browser.newPage();

    try {
      // Capture HTTP response status
      page.on('response', (response) => {
        if (response.url() === url) {
          httpStatus = response.status();
          console.log(`[WEATHERZONE] HTTP response status: ${httpStatus}`);
        }
      });

      // Navigate to WeatherZone page
      console.log(`[WEATHERZONE] Navigating to ${url}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      } catch (navError: any) {
        // Detect specific navigation errors
        if (navError.message?.toLowerCase().includes('timeout')) {
          const errorDetails: WeatherZoneErrorDetails = {
            type: 'navigation_timeout',
            message: 'Navigation to WeatherZone page timed out after 30 seconds',
            httpStatus,
            originalError: navError.message
          };
          console.error(`[WEATHERZONE] ${errorDetails.message}`, navError);
          return {
            success: false,
            observations: [],
            source: 'error',
            error: errorDetails.message,
            errorDetails,
            site_id: siteId,
            date: observationDate
          };
        }

        // Check for rate limit from WeatherZone website
        if (httpStatus === 429) {
          const errorDetails: WeatherZoneErrorDetails = {
            type: 'rate_limit_exceeded',
            message: 'WeatherZone website returned 429 Too Many Requests',
            httpStatus: 429,
            retryAfter: 60,
            originalError: navError.message
          };
          console.error(`[WEATHERZONE] ${errorDetails.message}`, navError);
          return {
            success: false,
            observations: [],
            source: 'error',
            error: errorDetails.message,
            errorDetails,
            site_id: siteId,
            date: observationDate
          };
        }

        // Generic navigation failure
        const errorDetails: WeatherZoneErrorDetails = {
          type: 'navigation_failed',
          message: `Failed to navigate to WeatherZone page${httpStatus ? ` (HTTP ${httpStatus})` : ''}`,
          httpStatus,
          originalError: navError.message
        };
        console.error(`[WEATHERZONE] ${errorDetails.message}`, navError);
        return {
          success: false,
          observations: [],
          source: 'error',
          error: errorDetails.message,
          errorDetails,
          site_id: siteId,
          date: observationDate
        };
      }

      // Wait for observations table to appear
      await page.waitForSelector('table, [data-table], .observations-table', { timeout: 10000 })
        .catch(() => console.log('[WEATHERZONE] Observation table selector not found, continuing...'));

      // Extract observations from rendered page using WeatherZone's class structure
      console.log(`[WEATHERZONE] Extracting observations using class-based selectors`);
      console.log(`[WEATHERZONE] observationDate parameter: "${observationDate}"`);
      let observations: any[];
      try {
        observations = await page.evaluate((obsDate, pageUrl) => {
          // CRITICAL: Validate obsDate was passed correctly from outer context
          // Fallback: extract from URL if obsDate is invalid
          let effectiveDate = obsDate;
          if (!effectiveDate || typeof effectiveDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
            // Try to extract date from URL: /observations/YYYY-MM-DD
            const urlMatch = pageUrl?.match(/\/observations\/(\d{4}-\d{2}-\d{2})/);
            if (urlMatch) {
              effectiveDate = urlMatch[1];
              console.log('[WEATHERZONE-EVAL] Recovered date from URL:', effectiveDate);
            } else {
              console.error('[WEATHERZONE-EVAL] Invalid obsDate and could not recover from URL:', obsDate);
              throw new Error(`Invalid obsDate passed to page.evaluate: ${obsDate}`);
            }
          }
          const results: any[] = [];

          // Find all observation rows - they have the hourly-obs-* class pattern
          const rows = document.querySelectorAll('tr');

          for (const row of rows) {
            try {
              // Extract data from cells with specific classes
              const dateCell = row.querySelector('.hourly-obs-date');
              const tempCell = row.querySelector('.hourly-obs-temperature');
              const humidityCell = row.querySelector('.hourly-obs-humidityt, .hourly-obs-humidity');
              const windCell = row.querySelector('.hourly-obs-windSpeed');
              const dewPointCell = row.querySelector('.hourly-obs-dewPoint');
              const apparentTempCell = row.querySelector('.hourly-obs-apparentTemperature');

              if (!dateCell || !tempCell) continue; // Skip rows without required fields

              // Extract text from cells (may be in <p> tags or directly)
              const dateText = dateCell.textContent?.trim() || '';
              const tempText = tempCell.querySelector('p')?.textContent?.trim() ||
                             tempCell.textContent?.trim() || '';
              const humidityText = humidityCell?.querySelector('p')?.textContent?.trim() ||
                                 humidityCell?.textContent?.trim() || '';
              // NOTE: WeatherZone labels wind field as 'wind_kmh' but values are already in m/s - no conversion needed
              const windText = windCell?.querySelector('p')?.textContent?.trim() ||
                             windCell?.textContent?.trim() || '';
              const dewPointText = dewPointCell?.querySelector('p')?.textContent?.trim() ||
                                 dewPointCell?.textContent?.trim() || '';

              // Parse numeric values
              const temp = parseFloat(tempText);
              const humidity = parseFloat(humidityText);
              const windSpeed = parseFloat(windText); // Already in m/s despite 'wind_kmh' label
              const dewPoint = parseFloat(dewPointText);

              if (!isNaN(temp) && dateText) {
                // Convert time text to ISO datetime
                // Known formats:
                // - "Sun 11:50 AEDT" (WeatherZone hourly obs page)
                // - "8:00 AM" or "8:00 PM" (12-hour)
                // - "14:30" (24-hour)
                // - Already ISO format (2025-12-01T10:20:00)
                let isoTime: string;
                // Check for ISO format: YYYY-MM-DDTHH:MM:SS (must be full ISO pattern, not just containing 'T')
                // The previous check `dateText.includes('T')` incorrectly matched "AEDT" timezone strings
                if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateText)) {
                  // Already looks like ISO format
                  isoTime = dateText;
                } else {
                  // Parse time and combine with observation date
                  let hours = 0;
                  let minutes = 0;
                  let parsed = false;

                  // Try parsing "Sun 11:50 AEDT" format (day + HH:MM + timezone)
                  const wzMatch = dateText.match(/\w+\s+(\d{1,2}):(\d{2})\s*(?:AEDT|AEST|[A-Z]{3,4})?/i);
                  if (wzMatch) {
                    hours = parseInt(wzMatch[1], 10);
                    minutes = parseInt(wzMatch[2], 10);
                    parsed = true;
                  }

                  // Try parsing "8:00 AM" or "8:00 PM" format
                  if (!parsed) {
                    const ampmMatch = dateText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                    if (ampmMatch) {
                      hours = parseInt(ampmMatch[1], 10);
                      minutes = parseInt(ampmMatch[2], 10);
                      const isPM = ampmMatch[3].toUpperCase() === 'PM';
                      if (isPM && hours !== 12) hours += 12;
                      if (!isPM && hours === 12) hours = 0;
                      parsed = true;
                    }
                  }

                  // Try parsing "14:30" 24-hour format
                  if (!parsed) {
                    const h24Match = dateText.match(/(\d{1,2}):(\d{2})/);
                    if (h24Match) {
                      hours = parseInt(h24Match[1], 10);
                      minutes = parseInt(h24Match[2], 10);
                      parsed = true;
                    }
                  }

                  // Construct ISO datetime: effectiveDate is YYYY-MM-DD
                  const hh = hours.toString().padStart(2, '0');
                  const mm = minutes.toString().padStart(2, '0');
                  isoTime = `${effectiveDate}T${hh}:${mm}:00`;
                }

                results.push({
                  time: isoTime,
                  temperature_c: temp,
                  humidity_pct: !isNaN(humidity) ? humidity : undefined,
                  wind_speed_ms: !isNaN(windSpeed) ? windSpeed : undefined,
                  dewpoint_c: !isNaN(dewPoint) ? dewPoint : undefined
                });
              }
            } catch (e) {
              // Skip malformed rows
              continue;
            }
          }

          return results;
        }, observationDate, url);
      } catch (evalError: any) {
        console.error(`[WEATHERZONE] page.evaluate() error: ${evalError.message}`);
        const errorDetails: WeatherZoneErrorDetails = {
          type: 'parsing_error',
          message: evalError.message || 'Failed to extract observations from page'
        };
        return {
          success: false,
          observations: [],
          error: `Observation extraction failed: ${evalError.message}`,
          errorDetails,
          site_id: siteId,
          date: observationDate
        };
      }

      console.log(`[WEATHERZONE] Found ${observations.length} observations`);

      if (observations.length > 0) {
        console.log(`[WEATHERZONE] Successfully extracted ${observations.length} observations`);
        return {
          success: true,
          observations,
          source: 'weatherzone',
          site_id: siteId,
          date: observationDate
        };
      } else {
        // Get page details for debugging
        const pageTitle = await page.title();
        const pageUrl = page.url();
        console.log(`[WEATHERZONE] No observations found. Page title: "${pageTitle}", URL: ${pageUrl}`);

        // Check if we got a non-200 response
        if (httpStatus && httpStatus !== 200) {
          const errorDetails: WeatherZoneErrorDetails = {
            type: 'page_load_error',
            message: `WeatherZone returned HTTP ${httpStatus} - data may not be available for this date`,
            httpStatus
          };
          console.error(`[WEATHERZONE] ${errorDetails.message}`);
          return {
            success: false,
            observations: [],
            source: 'error',
            error: errorDetails.message,
            errorDetails,
            site_id: siteId,
            date: observationDate
          };
        }

        // Page loaded successfully but no data found
        const errorDetails: WeatherZoneErrorDetails = {
          type: 'no_data_found',
          message: 'No observations found in rendered page. Data may not be available for this date/station, or page structure changed.',
          httpStatus
        };
        console.error(`[WEATHERZONE] ${errorDetails.message}`);
        return {
          success: false,
          observations: [],
          source: 'error',
          error: errorDetails.message,
          errorDetails,
          site_id: siteId,
          date: observationDate
        };
      }
    } finally {
      await page.close();
    }
  } catch (error: any) {
    // Catch-all for any unexpected errors
    const errorDetails: WeatherZoneErrorDetails = {
      type: 'unknown_error',
      message: 'Unexpected error during browser rendering',
      httpStatus,
      originalError: error?.message || String(error)
    };
    console.error(`[WEATHERZONE] ${errorDetails.message}:`, error);
    return {
      success: false,
      observations: [],
      source: 'error',
      error: errorDetails.message,
      errorDetails,
      site_id: siteId,
      date: observationDate
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log(`[WEATHERZONE] Browser closed successfully`);
      } catch (closeError) {
        console.warn(`[WEATHERZONE] Error closing browser:`, closeError);
      }
    }
  }
}

// Legacy function kept for fallback - direct HTTP fetch (won't work for JS-rendered content)
async function fetchWeatherZoneDirect(
  siteId: string,
  observationDate: string
): Promise<WeatherZoneFetchResult> {
  const url = buildWeatherZoneURL(siteId, observationDate);

  try {
    console.log(`[WEATHERZONE] Direct HTTP fetch from ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      return {
        success: false,
        observations: [],
        source: 'error',
        error: `HTTP ${response.status}: ${response.statusText}`,
        site_id: siteId,
        date: observationDate
      };
    }

    const html = await response.text();

    // Parse HTML for observation data
    // NOTE: This is a basic implementation. WeatherZone likely uses JavaScript
    // to render data, so this may return empty results.
    const observations = parseWeatherZoneHTML(html, observationDate);

    if (observations.length === 0) {
      return {
        success: false,
        observations: [],
        source: 'error',
        error: 'No observations found in HTML. Site may require JavaScript rendering.',
        site_id: siteId,
        date: observationDate
      };
    }

    return {
      success: true,
      observations,
      cached: false,
      source: 'weatherzone',
      site_id: siteId,
      date: observationDate
    };

  } catch (error: any) {
    return {
      success: false,
      observations: [],
      source: 'error',
      error: error?.message || 'Unknown fetch error',
      site_id: siteId,
      date: observationDate
    };
  }
}

/**
 * Parse WeatherZone HTML for observation data
 *
 * This is a basic implementation that looks for common patterns.
 * WeatherZone likely uses JavaScript to render data, so this may fail.
 */
function parseWeatherZoneHTML(html: string, observationDate: string): WeatherZoneObservation[] {
  const observations: WeatherZoneObservation[] = [];

  // Look for JSON data embedded in script tags (common pattern)
  const scriptDataRegex = /<script[^>]*>[\s\S]*?observations["\s:]*(\[[\s\S]*?\])/gi;
  const jsonDataRegex = /observations["\s:]*(\[[\s\S]*?\])/gi;

  // Try to find embedded JSON data
  let match;
  while ((match = scriptDataRegex.exec(html)) !== null) {
    try {
      const jsonStr = match[1];
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data)) {
        // Process the observations
        for (const obs of data) {
          const parsed = parseObservationObject(obs, observationDate);
          if (parsed) {
            observations.push(parsed);
          }
        }
      }
    } catch (e) {
      // Continue searching
    }
  }

  // Also try looking for window.__INITIAL_STATE__ or similar patterns
  const initialStateRegex = /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/gi;
  while ((match = initialStateRegex.exec(html)) !== null) {
    try {
      const jsonStr = match[1];
      const state = JSON.parse(jsonStr);

      // Look for observations in the state object
      if (state.observations && Array.isArray(state.observations)) {
        for (const obs of state.observations) {
          const parsed = parseObservationObject(obs, observationDate);
          if (parsed) {
            observations.push(parsed);
          }
        }
      }
    } catch (e) {
      // Continue searching
    }
  }

  return observations;
}

/**
 * Parse a single observation object
 */
function parseObservationObject(obs: any, observationDate: string): WeatherZoneObservation | null {
  try {
    // Extract time
    let time = obs.time || obs.datetime || obs.timestamp;
    if (!time) return null;

    // Normalize time to ISO format
    if (!time.includes('T')) {
      // Assume it's time-only, combine with date
      time = `${observationDate}T${time}`;
    }

    // Extract temperature
    const temp = obs.temperature_c || obs.temperature || obs.temp;
    if (temp === null || temp === undefined) return null;

    return {
      time,
      temperature_c: parseFloat(temp),
      humidity_pct: obs.humidity_pct || obs.humidity ? parseFloat(obs.humidity_pct || obs.humidity) : undefined,
      dewpoint_c: obs.dewpoint_c || obs.dewpoint ? parseFloat(obs.dewpoint_c || obs.dewpoint) : undefined,
      wind_speed_ms: obs.wind_speed_ms || obs.wind ? parseFloat(obs.wind_speed_ms || obs.wind) : undefined
    };
  } catch (error) {
    return null;
  }
}
