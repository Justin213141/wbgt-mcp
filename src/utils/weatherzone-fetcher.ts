/**
 * WeatherZone Observations Fetcher
 *
 * Fetches historical weather observations from WeatherZone using Cloudflare Browser Rendering.
 * Uses Puppeteer to render JavaScript and extract observation data.
 */

import puppeteer from '@cloudflare/puppeteer';

export interface WeatherZoneObservation {
  time: string; // ISO datetime
  temperature_c: number;
  humidity_pct?: number;
  dewpoint_c?: number;
  wind_speed_ms?: number;
}

export interface WeatherZoneFetchResult {
  success: boolean;
  observations: WeatherZoneObservation[];
  cached?: boolean;
  source: 'weatherzone' | 'cache' | 'error';
  error?: string;
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
    return {
      success: false,
      observations: [],
      source: 'error',
      error: 'Browser rendering not available. Browser binding required.',
      site_id: siteId,
      date: observationDate
    };
  }

  let browser;
  try {
    console.log(`[WEATHERZONE] Launching browser for ${url}`);

    // Launch browser using Puppeteer
    browser = await puppeteer.launch(browserBinding);
    const page = await browser.newPage();

    try {
      // Navigate to WeatherZone page
      console.log(`[WEATHERZONE] Navigating to ${url}`);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait for observations table to appear
      await page.waitForSelector('table, [data-table], .observations-table', { timeout: 10000 })
        .catch(() => console.log('[WEATHERZONE] Observation table selector not found, continuing...'));

      // Extract observations from rendered page using WeatherZone's class structure
      console.log(`[WEATHERZONE] Extracting observations using class-based selectors`);
      const observations = await page.evaluate((obsDate) => {
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
            const windText = windCell?.querySelector('p')?.textContent?.trim() ||
                           windCell?.textContent?.trim() || '';
            const dewPointText = dewPointCell?.querySelector('p')?.textContent?.trim() ||
                               dewPointCell?.textContent?.trim() || '';

            // Parse numeric values
            const temp = parseFloat(tempText);
            const humidity = parseFloat(humidityText);
            const windSpeed = parseFloat(windText);
            const dewPoint = parseFloat(dewPointText);

            if (!isNaN(temp) && dateText) {
              results.push({
                time: dateText,
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
      }, observationDate);

      console.log(`[WEATHERZONE] Found ${observations.length} observations`);

      if (observations.length > 0) {
        return {
          success: true,
          observations,
          source: 'weatherzone',
          site_id: siteId,
          date: observationDate
        };
      } else {
        // Get page HTML for debugging
        const html = await page.content();
        console.log(`[WEATHERZONE] No observations found. Page title: ${await page.title()}`);

        return {
          success: false,
          observations: [],
          source: 'error',
          error: 'No observations found in rendered page. Page may have different structure.',
          site_id: siteId,
          date: observationDate
        };
      }
    } finally {
      await page.close();
    }
  } catch (error: any) {
    console.error(`[WEATHERZONE] Browser rendering error:`, error);
    return {
      success: false,
      observations: [],
      source: 'error',
      error: error?.message || 'Browser rendering failed',
      site_id: siteId,
      date: observationDate
    };
  } finally {
    if (browser) {
      await browser.close();
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
