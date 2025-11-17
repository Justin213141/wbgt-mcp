# WeatherZone Historical WBGT Implementation Plan

## Project Overview

Plan for implementing historical WBGT calculations using WeatherZone observational data combined with Open-Meteo solar radiation data. This system will operate offline (not as a Cloudflare Worker) and provide up to 1 year of historical observations for Australian locations.

## Core Objective

Replace BOM data source with WeatherZone for historical WBGT calculations, enabling:
- **Historical Range**: Up to 1 year of observational data (vs current 72-hour limit)
- **Geographic Scope**: Australian locations only
- **Calculation Method**: Kong WBGT with matched solar radiation from Open-Meteo

## Data Sources

### 1. WeatherZone Observations
**URL Pattern**: `https://www.weatherzone.com.au/station/SITE/{site_id}/observations/{YYYY-MM-DD}`

**Advantages**:
- 1 year historical data availability
- Hourly observations with detailed meteorological data
- Wide coverage of Australian weather stations

**Challenges Identified**:
- **403 Forbidden responses** - Anti-scraping protection active
- Requires station SITE ID mapping from lat/lon coordinates
- Australia-only coverage (need geographic filtering)

**Expected Data Fields**:
- Air temperature (°C)
- Relative humidity (%)
- Dew point (°C)
- Wind speed (km/h)
- Atmospheric pressure (hPa)
- Observation timestamps (local time)

### 2. Open-Meteo Historical API
**Purpose**: Solar radiation data to complement WeatherZone observations

**Critical Data**:
- Shortwave radiation (instant)
- Direct radiation (instant)
- Diffuse radiation (instant)
- Solar zenith angle calculations

**Integration**: Time-based matching of Open-Meteo solar data with WeatherZone observations

## System Architecture

### Deployment Environment
- **Offline System**: Not Cloudflare Worker
- **Processing**: Batch processing for historical data
- **Storage**: Local database/file system for cached results
- **Runtime**: Node.js/TypeScript standalone application

### Geographic Filtering

**Australian Boundary Checks**:
```
Latitude bounds: -44.0 to -10.0
Longitude bounds: 113.0 to 154.0
```

**Implementation**:
```typescript
function isAustralianLocation(lat: number, lon: number): boolean {
  return lat >= -44.0 && lat <= -10.0 &&
         lon >= 113.0 && lon <= 154.0;
}
```

Reject requests for locations outside Australia before attempting station lookup.

## Critical Implementation Challenges

### Challenge 1: Lat/Lon to WeatherZone SITE ID Mapping

**Problem**: WeatherZone uses station SITE IDs (e.g., 66212), not lat/lon coordinates.

**Proposed Solutions**:

#### Option A: Build Station Database
1. **Create comprehensive station registry**:
   ```typescript
   interface WeatherStation {
     siteId: string;
     name: string;
     latitude: number;
     longitude: number;
     state: string;
     elevation?: number;
   }
   ```

2. **Station Discovery Methods**:
   - Manual catalog from WeatherZone station lists
   - Scrape station directory pages
   - BOM station cross-reference (many stations shared)
   - User contributions/community data

3. **Nearest Station Algorithm**:
   ```typescript
   function findNearestStation(
     lat: number,
     lon: number,
     stations: WeatherStation[]
   ): WeatherStation {
     // Haversine distance calculation
     // Return closest station within max distance (e.g., 50km)
   }
   ```

#### Option B: Reverse Geocoding API
- Use location name → search WeatherZone station pages
- Extract SITE ID from search results
- Cache mappings for reuse

#### Option C: Hybrid Approach (RECOMMENDED)
1. Maintain curated database of major stations (capital cities, regional centers)
2. Use reverse geocoding for unknown locations
3. Cache all successful mappings
4. Fallback to nearest known station

**Initial Station Database Priority**:
- Sydney Observatory Hill (66212)
- Melbourne Regional Office
- Brisbane CBD
- Adelaide, Perth, Hobart, Darwin, Canberra major stations
- ~100 regional stations for coverage

### Challenge 2: Web Scraping Anti-Bot Protection

**Issue**: 403 Forbidden responses indicate anti-scraping measures

**Proposed Solutions**:

#### Option A: Polite Scraping with Headers
```typescript
const headers = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.weatherzone.com.au/',
  'Connection': 'keep-alive'
};
```

**Rate Limiting**:
- Delay between requests: 2-5 seconds minimum
- Implement exponential backoff on failures
- Respect robots.txt
- Maximum concurrent requests: 1

#### Option B: Headless Browser (Puppeteer/Playwright)
```typescript
import puppeteer from 'puppeteer';

async function fetchWeatherZonePage(
  siteId: string,
  date: string
): Promise<string> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0...');
  await page.goto(
    `https://www.weatherzone.com.au/station/SITE/${siteId}/observations/${date}`,
    { waitUntil: 'networkidle2' }
  );

  const content = await page.content();
  await browser.close();
  return content;
}
```

**Advantages**:
- Executes JavaScript like real browser
- Handles dynamic content
- Bypasses simple bot detection

**Disadvantages**:
- Slower than direct HTTP requests
- Higher resource usage
- More complex error handling

#### Option C: API Investigation
- Research if WeatherZone offers data API (commercial or public)
- Check for mobile app API endpoints
- Investigate RSS/JSON feeds

#### Option D: Alternative Data Sources
**If WeatherZone proves too difficult**:
- BOM historical data (SILO database)
- State-specific weather services
- ACORN-SAT dataset
- AWS Public Weather Data

**RECOMMENDED Approach**: Start with Option A (polite scraping), fallback to Option B (headless browser) if needed.

### Challenge 3: Solar Radiation Data Matching

**Problem**: Match hourly solar radiation from Open-Meteo with WeatherZone observations

**Solution Design**:

#### Time Synchronization
```typescript
interface WeatherZoneObservation {
  timestamp: string;  // Local time: "16/11/2025, 14:00"
  temperature: number;
  humidity: number;
  dewPoint: number;
  windSpeed: number;
  pressure: number;
}

interface OpenMeteoRadiation {
  time: string;  // ISO format: "2025-11-16T14:00"
  solarRadiation: number;
  directRadiation: number;
  diffuseRadiation: number;
}
```

#### Matching Algorithm
```typescript
function matchSolarRadiation(
  wzObs: WeatherZoneObservation,
  omData: OpenMeteoRadiation[],
  timezone: string
): number {
  // Convert WeatherZone local time to ISO
  const wzIsoTime = convertToISO(wzObs.timestamp, timezone);

  // Find matching hour in Open-Meteo data
  const hourKey = wzIsoTime.substring(0, 13); // "2025-11-16T14"

  // Exact match or nearest hour
  const radiation = omData.find(r => r.time.startsWith(hourKey));

  return radiation?.solarRadiation || estimateSolarRadiation(wzObs.timestamp);
}
```

#### Timezone Handling
```typescript
const TIMEZONE_MAP = {
  'NSW': 'Australia/Sydney',
  'VIC': 'Australia/Melbourne',
  'QLD': 'Australia/Brisbane',
  'SA': 'Australia/Adelaide',
  'WA': 'Australia/Perth',
  'TAS': 'Australia/Hobart',
  'NT': 'Australia/Darwin',
  'ACT': 'Australia/Sydney'
};
```

#### Fallback Strategy
When solar radiation unavailable:
1. Check adjacent hours (±1 hour)
2. Use solar zenith angle estimation
3. Time-of-day based estimation (sunrise/sunset calculations)
4. Mark data quality flag in results

## Implementation Phases

### Phase 1: Research & Setup (Week 1)
**Goals**:
- [ ] Test WeatherZone scraping approaches (headers vs headless browser)
- [ ] Identify optimal request patterns to avoid blocking
- [ ] Build initial station database (Sydney, Melbourne, Brisbane stations)
- [ ] Document HTML structure and data extraction patterns

**Deliverables**:
- Working scraper prototype for single station/date
- Station database schema and initial data
- Anti-blocking strategy documentation

### Phase 2: Core Data Pipeline (Week 2)
**Goals**:
- [ ] Implement WeatherZone HTML parsing
- [ ] Build Open-Meteo solar radiation fetcher
- [ ] Create time-matching algorithm
- [ ] Implement geographic filtering

**Components**:
```typescript
// weatherzone-scraper.ts
class WeatherZoneScraper {
  async fetchObservations(siteId: string, date: string): Promise<Observation[]>;
  async parseHTML(html: string): Promise<Observation[]>;
}

// solar-matcher.ts
class SolarRadiationMatcher {
  async fetchOpenMeteo(lat: number, lon: number, date: string): Promise<RadiationData[]>;
  matchByTimestamp(wzObs: Observation[], omRad: RadiationData[]): MatchedData[];
}

// station-mapper.ts
class StationMapper {
  findNearestStation(lat: number, lon: number): WeatherStation;
  validateAustralianLocation(lat: number, lon: number): boolean;
}
```

**Deliverables**:
- Complete data fetching pipeline
- Unit tests for each component
- Error handling and retry logic

### Phase 3: WBGT Calculation Integration (Week 3)
**Goals**:
- [ ] Integrate existing Kong WBGT calculation functions
- [ ] Adapt for WeatherZone data format
- [ ] Handle missing data scenarios
- [ ] Validate results against known values

**Integration**:
```typescript
async function calculateHistoricalWBGT(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<WBGTResult[]> {
  // 1. Validate Australian location
  if (!isAustralianLocation(latitude, longitude)) {
    throw new Error('Location outside Australia');
  }

  // 2. Find nearest WeatherZone station
  const station = stationMapper.findNearestStation(latitude, longitude);

  // 3. Fetch WeatherZone observations
  const wzObs = await scraper.fetchObservations(station.siteId, startDate, endDate);

  // 4. Fetch Open-Meteo solar radiation
  const omRad = await solarMatcher.fetchOpenMeteo(latitude, longitude, startDate, endDate);

  // 5. Match datasets
  const matched = solarMatcher.matchByTimestamp(wzObs, omRad);

  // 6. Calculate Kong WBGT for each observation
  return matched.map(obs => calculateKongWBGTPipeline(obs));
}
```

**Deliverables**:
- Working end-to-end WBGT calculation
- Validation report comparing results
- Performance benchmarks

### Phase 4: Production Hardening (Week 4)
**Goals**:
- [ ] Implement caching layer (local SQLite or file system)
- [ ] Add comprehensive logging
- [ ] Build rate limiting and retry mechanisms
- [ ] Create CLI interface for standalone use
- [ ] Documentation and usage examples

**Caching Strategy**:
```typescript
// Cache both raw data and calculated results
interface CacheEntry {
  key: string;  // `${siteId}:${date}`
  data: Observation[];
  calculatedWBGT?: WBGTResult[];
  fetchedAt: Date;
  expiresAt: Date;  // Raw data: 1 week, Calculated: permanent
}
```

**Deliverables**:
- Production-ready standalone application
- User documentation
- Performance optimization report

## Data Extraction Patterns

### WeatherZone HTML Structure (To Be Determined)

**Research Needed**:
- Table structure for observations
- CSS selectors for data extraction
- JavaScript-rendered content detection
- Pagination patterns (if multiple pages per day)

**Expected Extraction Logic**:
```typescript
function parseWeatherZoneHTML(html: string): Observation[] {
  const $ = cheerio.load(html);
  const observations: Observation[] = [];

  // Find observation table rows
  $('table.observations tbody tr').each((i, row) => {
    const cells = $(row).find('td');

    observations.push({
      timestamp: $(cells[0]).text().trim(),
      temperature: parseFloat($(cells[1]).text()),
      humidity: parseFloat($(cells[2]).text()),
      dewPoint: parseFloat($(cells[3]).text()),
      windSpeed: parseFloat($(cells[4]).text()),
      pressure: parseFloat($(cells[5]).text())
    });
  });

  return observations;
}
```

## Technology Stack

### Core Dependencies
```json
{
  "dependencies": {
    "cheerio": "^1.0.0",           // HTML parsing
    "puppeteer": "^21.0.0",         // Headless browser (if needed)
    "node-fetch": "^3.3.0",         // HTTP requests
    "date-fns-tz": "^2.0.0",        // Timezone handling
    "better-sqlite3": "^9.0.0",     // Local caching
    "commander": "^11.0.0",         // CLI interface
    "zod": "^3.22.0"                // Data validation
  }
}
```

### Utilities Needed
- Haversine distance calculator for station matching
- Solar angle calculator (reuse from existing Kong WBGT)
- Robust date/time parser for Australian formats
- HTML sanitization and validation

## Data Quality & Validation

### Quality Checks
1. **Completeness**: Flag missing fields in WeatherZone data
2. **Plausibility**: Validate ranges (temp: -10 to 50°C, humidity: 0-100%)
3. **Temporal Consistency**: Check for timestamp gaps or duplicates
4. **Solar Radiation Match Quality**: Track match success rate

### Validation Metrics
```typescript
interface DataQuality {
  totalObservations: number;
  completeRecords: number;
  solarMatchRate: number;        // % with matched radiation data
  averageStationDistance: number; // km from requested location
  dataGaps: number;              // missing hourly observations
  implausibleValues: number;
}
```

## Ethical & Legal Considerations

### Responsible Scraping
1. **Robots.txt Compliance**: Check and respect WeatherZone's robots.txt
2. **Rate Limiting**: Never exceed 1 request per 2 seconds
3. **Attribution**: Credit WeatherZone as data source
4. **Terms of Service**: Review and comply with ToS
5. **Consider Commercial API**: Check if WeatherZone offers paid data access

### Alternative if Scraping Blocked
- **BOM SILO Database**: Free historical weather data for Australia
- **API Purchase**: Commercial weather data providers
- **Academic Access**: Research institutions may have data access

## Output Format

### API Response
```typescript
interface HistoricalWBGTResponse {
  success: boolean;
  location: {
    requested: { latitude: number; longitude: number };
    station: {
      siteId: string;
      name: string;
      latitude: number;
      longitude: number;
      distance: number;  // km from requested location
    };
  };
  dateRange: {
    start: string;
    end: string;
  };
  data: Array<{
    timestamp: string;  // ISO format
    temperature: number;
    humidity: number;
    dewPoint: number;
    windSpeed: number;
    pressure: number;
    solarRadiation: number;
    solarRadiationSource: 'matched' | 'estimated' | 'interpolated';
    wbgt: number;
    esi: number;
    apparentTemp: number;
    dataQuality: 'complete' | 'partial' | 'estimated';
  }>;
  metadata: {
    totalRecords: number;
    completeRecords: number;
    calculationMethod: 'kong_wbgt';
    dataQuality: DataQuality;
  };
}
```

## Success Criteria

1. **Data Coverage**: Successfully retrieve 1 year of historical data for major Australian cities
2. **Solar Match Rate**: >90% of observations matched with Open-Meteo solar radiation
3. **Geographic Coverage**: Support for at least 100 Australian weather stations
4. **Performance**: Process 1 year of hourly data in <5 minutes
5. **Reliability**: <5% scraping failure rate with automatic retry
6. **Accuracy**: WBGT values within ±0.5°C of BOM-based calculations (where comparable)

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| WeatherZone blocks scraping | High | High | Implement headless browser, use commercial API, switch to BOM SILO |
| SITE ID mapping incomplete | Medium | Medium | Crowdsource station data, partner with meteorological community |
| Solar radiation mismatch | Low | Medium | Implement robust estimation fallbacks, validation checks |
| Performance issues | Low | Low | Add caching, batch processing, async operations |
| Legal concerns | Low | High | Consult ToS, consider commercial licensing, use official APIs |

## Next Steps

### Immediate Actions (Week 1)
1. **Test scraping approaches**: Run experiments with different headers/methods
2. **Catalog stations**: Build initial database with 10-20 major stations
3. **Parse HTML sample**: Capture and analyze WeatherZone observation page structure
4. **Validate Open-Meteo**: Confirm historical solar radiation data availability

### Documentation Needs
- WeatherZone HTML structure analysis
- Station database schema and sample data
- Error handling decision tree
- User guide for CLI tool

### Questions to Resolve
1. What is the exact HTML structure of WeatherZone observation tables?
2. Can we identify a pattern for SITE ID allocation (geographic, BOM station correlation)?
3. Does WeatherZone have an undocumented API we can use?
4. What is the acceptable use policy for research/non-commercial use?

## References

- **Current Implementation**: `/src/index.ts` (lines 186-216, 1324-1336)
- **Kong WBGT Functions**: `/src/calculations/` modules
- **Open-Meteo Historical API**: https://open-meteo.com/en/docs/historical-weather-api
- **WeatherZone Example**: https://www.weatherzone.com.au/station/SITE/66212/observations/2025-11-16
- **BOM Alternative**: http://www.bom.gov.au/climate/data/
