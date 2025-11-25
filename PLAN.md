# Visual Crossing Implementation Plan ⚠️ SUPERSEDED

**Status**: This plan has been superseded. See implementation details in SUMMARY.md (November 20, 2025 update).

**Original Objective**: Implement Visual Crossing Weather API integration to fill 3-day to 3-month observational data gap in the `/observations` endpoint with automatic routing based on data age.

**Actual Implementation**: Created separate `/api/VC_observations/` endpoint for Visual Crossing data instead of integrating into `/api/observations` tiered routing. Also created `/api/meteostat_observations/` for Meteostat station data.

**Rationale for Change**:
- Better architectural separation (single-responsibility endpoints)
- No API key required for basic `/api/observations` usage
- User choice of data source
- Cost optimization (Visual Crossing costs only when explicitly requested)
- Clearer API design

See `SUMMARY.md` ("API Architecture Evolution: Phase I Complete") for current architecture details.

---

## Original Plan (Historical Reference Only)

**Target Endpoint**: `/observations` with automatic routing based on data age
**Implementation Approach**: 3-tier system with seamless handoff between data sources

---

## Overview

### Current State
- **Tier 1** (0-3 days): BOM + Open-Meteo Solar ✅ Working
- **Tier 2** (3-90 days): ❌ **DATA GAP** - No observational data
- **Tier 3** (90+ days): NOAA ISD + Open-Meteo Solar ✅ Working via `/historic_observations`

### Target State
- **Tier 1** (0-3 days): BOM + Open-Meteo Solar ✅ No changes
- **Tier 2** (3-90 days): **Visual Crossing** + Open-Meteo Solar 📋 To implement
- **Tier 3** (90+ days): NOAA ISD + Open-Meteo Solar ✅ No changes

---

## Visual Crossing API Specifications

### Authentication
- **API Key**: Required in query parameter or header
- **Free Tier**: 1000 records per day
- **Cost**: $0.0001 per record after free tier

### Endpoint Structure
```
GET https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/{location}/{startdate}/{enddate}
```

### Required Parameters
- `location`: Latitude,Longitude (e.g., `-33.8167,151.0833`)
- `startdate`: YYYY-MM-DD format (e.g., `2025-11-12`)
- `enddate`: YYYY-MM-DD format (e.g., `2025-11-19`)
- `key`: API key
- `unitGroup`: `metric` (temperature in °C, wind in km/h)
- `include`: `hours` (include hourly data in response)
- `elements`: Comma-separated list of required fields

### Recommended Elements
```
temp,humidity,dew,precip,windspeed,winddir,sealevelpressure,cloudcover,visibility,conditions
```

### Example Request
```
https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/-33.8167,151.0833/2025-11-12/2025-11-19?unitGroup=metric&include=hours&elements=temp,humidity,dew,windspeed,sealevelpressure,cloudcover&key=YOUR_API_KEY
```

### Response Structure
```json
{
  "queryCost": 168,
  "latitude": -33.8167,
  "longitude": 151.0833,
  "resolvedAddress": "Sydney, NSW, Australia",
  "address": "-33.8167,151.0833",
  "timezone": "Australia/Sydney",
  "days": [
    {
      "datetime": "2025-11-12",
      "tempmax": 25.6,
      "tempmin": 18.3,
      "temp": 21.8,
      "hours": [
        {
          "datetime": "00:00:00",
          "temp": 19.2,
          "humidity": 72.5,
          "dew": 14.3,
          "windspeed": 15.4,
          "sealevelpressure": 1013.2,
          "cloudcover": 45.0
        }
      ]
    }
  ],
  "stations": {
    "94767": {
      "distance": 18.2,
      "latitude": -33.95,
      "longitude": 151.17,
      "name": "SYDNEY AIRPORT"
    }
  }
}
```

---

## Implementation Design

### File Structure
```
src/
├── utils/
│   ├── visual-crossing-fetcher.ts    # NEW: Visual Crossing API integration
│   ├── historical-fetcher.ts          # EXISTING: NOAA ISD integration
│   └── station-finder.ts              # EXISTING: BOM station selection
└── index.ts                           # MODIFY: Add Tier 2 routing logic
```

### Module: `visual-crossing-fetcher.ts`

```typescript
/**
 * Visual Crossing Weather API Integration
 * Fills 3-day to 3-month observational data gap
 */

export interface VisualCrossingConfig {
  apiKey: string;
  unitGroup: 'metric' | 'us';
  elements: string[];
  baseUrl: string;
}

export interface VisualCrossingObservation {
  timestamp: string;           // ISO 8601 local time
  temperature: number;          // °C
  humidity: number;             // %
  dew_point: number;           // °C
  wind_speed: number;          // km/h (convert to m/s)
  sea_level_pressure: number;  // hPa
  cloud_cover: number;         // %
  visibility?: number;         // km
  conditions?: string;         // Weather description
}

export interface VisualCrossingResponse {
  queryCost: number;
  latitude: number;
  longitude: number;
  timezone: string;
  days: Array<{
    datetime: string;
    hours: Array<{
      datetime: string;  // "HH:MM:SS"
      temp: number;
      humidity: number;
      dew: number;
      windspeed: number;
      sealevelpressure: number;
      cloudcover: number;
    }>;
  }>;
  stations: Record<string, {
    distance: number;
    latitude: number;
    longitude: number;
    name: string;
  }>;
}

export class VisualCrossingFetcher {
  private config: VisualCrossingConfig;
  private requestCount: number = 0;
  private dailyResetTime: Date;

  constructor(apiKey: string) {
    this.config = {
      apiKey,
      unitGroup: 'metric',
      elements: ['temp', 'humidity', 'dew', 'windspeed', 'sealevelpressure', 'cloudcover'],
      baseUrl: 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'
    };
    this.dailyResetTime = this.getNextDailyReset();
  }

  /**
   * Fetch weather observations for date range
   *
   * @param latitude Latitude
   * @param longitude Longitude
   * @param startDate ISO date string (YYYY-MM-DD)
   * @param endDate ISO date string (YYYY-MM-DD)
   * @returns Array of hourly observations
   */
  async fetchObservations(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): Promise<VisualCrossingObservation[]> {
    // Check free tier limit
    await this.checkRateLimit();

    const url = this.buildUrl(latitude, longitude, startDate, endDate);

    console.log(`[VISUAL-CROSSING] Fetching data for ${startDate} to ${endDate}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Visual Crossing rate limit exceeded');
        }
        throw new Error(`Visual Crossing API error: ${response.status}`);
      }

      const data = await response.json() as VisualCrossingResponse;

      // Track query cost
      console.log(`[VISUAL-CROSSING] Query cost: ${data.queryCost} records`);
      this.requestCount += data.queryCost;

      // Parse response
      const observations = this.parseResponse(data);

      console.log(`[VISUAL-CROSSING] Retrieved ${observations.length} hourly observations`);
      console.log(`[VISUAL-CROSSING] Contributing stations:`, Object.keys(data.stations).map(id =>
        `${data.stations[id].name} (${data.stations[id].distance.toFixed(1)}km)`
      ).join(', '));

      return observations;
    } catch (error) {
      console.error('[VISUAL-CROSSING] Error fetching data:', error);
      throw error;
    }
  }

  /**
   * Convert Visual Crossing observations to hourly arrays for Kong WBGT
   */
  convertToHourlyArrays(
    observations: VisualCrossingObservation[],
    timezone: string
  ): {
    times: string[];
    temps: number[];
    humidity: number[];
    dewpoints: number[];
    pressures: number[];
    windSpeeds: number[];
    cloudCovers: number[];
  } {
    const times: string[] = [];
    const temps: number[] = [];
    const humidity: number[] = [];
    const dewpoints: number[] = [];
    const pressures: number[] = [];
    const windSpeeds: number[] = [];
    const cloudCovers: number[] = [];

    for (const obs of observations) {
      times.push(obs.timestamp);
      temps.push(obs.temperature);
      humidity.push(obs.humidity);
      dewpoints.push(obs.dew_point);
      pressures.push(obs.sea_level_pressure);
      windSpeeds.push(obs.wind_speed / 3.6); // km/h to m/s
      cloudCovers.push(obs.cloud_cover);
    }

    return { times, temps, humidity, dewpoints, pressures, windSpeeds, cloudCovers };
  }

  private buildUrl(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): string {
    const location = `${latitude},${longitude}`;
    const params = new URLSearchParams({
      unitGroup: this.config.unitGroup,
      include: 'hours',
      elements: this.config.elements.join(','),
      key: this.config.apiKey
    });

    return `${this.config.baseUrl}/${location}/${startDate}/${endDate}?${params}`;
  }

  private parseResponse(data: VisualCrossingResponse): VisualCrossingObservation[] {
    const observations: VisualCrossingObservation[] = [];

    for (const day of data.days) {
      for (const hour of day.hours) {
        // Combine date + time: "2025-11-12" + "14:00:00" -> "2025-11-12T14:00:00"
        const timestamp = `${day.datetime}T${hour.datetime.substring(0, 5)}`; // Remove seconds

        observations.push({
          timestamp,
          temperature: hour.temp,
          humidity: hour.humidity,
          dew_point: hour.dew,
          wind_speed: hour.windspeed,
          sea_level_pressure: hour.sealevelpressure,
          cloud_cover: hour.cloudcover
        });
      }
    }

    return observations.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  private async checkRateLimit(): Promise<void> {
    const now = new Date();

    // Reset counter if past daily reset time
    if (now >= this.dailyResetTime) {
      this.requestCount = 0;
      this.dailyResetTime = this.getNextDailyReset();
      console.log('[VISUAL-CROSSING] Daily rate limit reset');
    }

    // Warn if approaching limit
    if (this.requestCount >= 900) {
      console.warn(`[VISUAL-CROSSING] Approaching daily limit: ${this.requestCount}/1000 records used`);
    }

    if (this.requestCount >= 1000) {
      throw new Error('Visual Crossing daily free tier limit (1000 records) exceeded');
    }
  }

  private getNextDailyReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Midnight
    return tomorrow;
  }

  /**
   * Calculate wet bulb temperature from temperature, humidity, and pressure
   * Using Stull (2011) approximation formula
   */
  private calculateWetBulb(
    temp: number,      // °C
    humidity: number,  // %
    pressure: number   // hPa
  ): number {
    const Tw = temp * Math.atan(0.151977 * Math.pow(humidity + 8.313659, 0.5))
             + Math.atan(temp + humidity)
             - Math.atan(humidity - 1.676331)
             + 0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity)
             - 4.686035;

    return Tw;
  }
}
```

---

## Endpoint Routing Logic

### Update `/observations` Handler in `src/index.ts`

```typescript
async function handleGetObservations(url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const start_time = url.searchParams.get('start_time') || undefined;
  const end_time = url.searchParams.get('end_time') || undefined;
  const latitude = url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : undefined;
  const longitude = url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : undefined;

  // Determine which tier to use based on data age
  let dataSource: string;
  let observations: any[];

  if (start_time) {
    const now = new Date();
    const startDate = new Date(start_time);
    const ageInDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays <= 3) {
      // TIER 1: Use BOM + Open-Meteo (0-3 days ago)
      dataSource = 'BOM + Open-Meteo';
      // ... existing BOM logic

    } else if (ageInDays <= 90) {
      // TIER 2: Use Visual Crossing + Open-Meteo (3-90 days ago)
      dataSource = 'Visual Crossing + Open-Meteo';

      const vcFetcher = new VisualCrossingFetcher(env.VISUAL_CROSSING_API_KEY);
      const vcData = await vcFetcher.fetchObservations(
        latitude || SYDNEY_LAT,
        longitude || SYDNEY_LON,
        start_time.split('T')[0], // Extract date from ISO string
        (end_time || new Date().toISOString()).split('T')[0]
      );

      // Fetch solar radiation from Open-Meteo
      const solarData = await fetchSatelliteRadiation(
        start_time.split('T')[0],
        (end_time || new Date().toISOString()).split('T')[0],
        latitude || SYDNEY_LAT,
        longitude || SYDNEY_LON
      );

      // Combine Visual Crossing weather + Open-Meteo solar → Kong WBGT
      observations = await combineVisualCrossingWithSolar(vcData, solarData, latitude, longitude);

    } else {
      // TIER 3: Redirect to historic_observations (90+ days ago)
      return errorResponse(
        'USE_HISTORIC_ENDPOINT',
        'For data older than 90 days, use /api/historic_observations endpoint',
        400,
        corsHeaders,
        {
          recommendation: 'Use /api/historic_observations for data beyond 90 days',
          requested_date: start_time
        },
        url.pathname
      );
    }
  } else {
    // No time filter: Use existing recent data logic (Tier 1)
    dataSource = 'BOM + Open-Meteo (recent)';
    // ... existing logic
  }

  return jsonResponse({
    success: true,
    data: observations,
    count: observations.length,
    source: dataSource,
    timestamp: new Date().toISOString()
  }, 200, corsHeaders);
}
```

---

## Data Combination Strategy

### Visual Crossing + Solar Radiation → Kong WBGT

Similar to existing NOAA ISD approach in `historical-fetcher.ts`:

1. **Fetch Visual Crossing data** (temperature, humidity, dew point, pressure, wind, cloud cover)
2. **Fetch Open-Meteo solar radiation** (satellite or archive)
3. **Calculate wet bulb temperature** using Stull formula (temp + humidity + pressure)
4. **Align timestamps** (match hourly Visual Crossing with hourly solar data)
5. **Calculate Kong WBGT** using existing `calculateKongWBGTPipelineByTimezone()`

```typescript
async function combineVisualCrossingWithSolar(
  vcData: VisualCrossingObservation[],
  solarData: SatelliteRadiationData,
  latitude: number,
  longitude: number
): Promise<any[]> {
  const results: any[] = [];

  const vcFetcher = new VisualCrossingFetcher(env.VISUAL_CROSSING_API_KEY);
  const arrays = vcFetcher.convertToHourlyArrays(vcData, 'Australia/Sydney');

  // Build solar radiation time-indexed map
  const solarMap: Record<string, { sr: number; direct: number; diffuse: number }> = {};
  const times = solarData?.hourly?.time || [];
  const srInstant = solarData?.hourly?.shortwave_radiation_instant || [];
  const srDirect = solarData?.hourly?.direct_radiation_instant || [];
  const srDiffuse = solarData?.hourly?.diffuse_radiation_instant || [];

  times.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13); // "2025-11-19T14"
    solarMap[hourKey] = {
      sr: srInstant[idx] || 0,
      direct: srDirect[idx] || 0,
      diffuse: srDiffuse[idx] || 0
    };
  });

  // Combine data and calculate WBGT
  arrays.times.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    const solar = solarMap[hourKey] || { sr: 0, direct: 0, diffuse: 0 };

    const Ta = arrays.temps[idx];
    const RH = arrays.humidity[idx];
    const Tdew = arrays.dewpoints[idx];
    const P = arrays.pressures[idx];
    const u = arrays.windSpeeds[idx];

    // Calculate wet bulb
    const Tw = calculateWetBulbTemperature(Ta, RH, P);

    // Calculate Kong WBGT
    const kongCalc = calculateKongWBGTPipelineByTimezone(
      Ta, Tw, RH, P, u,
      solar.sr, solar.direct, solar.diffuse,
      latitude, longitude, time,
      10, // UTC offset for Sydney
      true // has DST
    );

    results.push({
      timestamp: time,
      temperature: parseFloat(Ta.toFixed(1)),
      humidity: Math.round(RH),
      dew_point: parseFloat(Tdew.toFixed(1)),
      wind_speed_ms: parseFloat(u.toFixed(2)),
      solar_radiation: parseFloat(solar.sr.toFixed(1)),
      cloud_cover: parseFloat(arrays.cloudCovers[idx].toFixed(1)),
      wbgt: parseFloat(kongCalc.kong_wbgt.toFixed(1)),
      esi: parseFloat(kongCalc.esi.toFixed(1)),
      weather_source: 'Visual Crossing',
      solar_source: solar.sr > 0 ? 'satellite' : 'archive'
    });
  });

  return results;
}
```

---

## Environment Configuration

Add Visual Crossing API key to environment variables:

### Cloudflare Workers (wrangler.toml)
```toml
[vars]
VISUAL_CROSSING_API_KEY = "YOUR_API_KEY_HERE"
```

### Local Development (.dev.vars)
```
VISUAL_CROSSING_API_KEY=YOUR_API_KEY_HERE
```

---

## Error Handling

### Rate Limiting
- Track daily query cost (reset at midnight)
- Warn at 900/1000 records
- Throw error at 1000/1000 records
- Return clear error message with retry timing

### API Errors
- **429 Too Many Requests**: Rate limit exceeded
- **400 Bad Request**: Invalid parameters (check date format, location)
- **401 Unauthorized**: Invalid API key
- **500 Server Error**: Visual Crossing service issue

### Fallback Strategy
```
Primary: Visual Crossing (3-90 days)
  ↓ (if unavailable or rate limited)
Fallback: Return error with suggestion to use historic_observations
  ↓ (user can decide)
Alternative: Open-Meteo Archive (model data, not observational)
```

---

## Testing Strategy

### Unit Tests
1. **Visual Crossing Fetcher** (`visual-crossing-fetcher.test.ts`):
   - URL building with correct parameters
   - Response parsing (days → hours → observations)
   - Timestamp formatting (combine date + time)
   - Wind speed conversion (km/h → m/s)
   - Rate limit tracking and daily reset

2. **Data Combination**:
   - Align Visual Crossing timestamps with solar radiation
   - Handle missing solar data gracefully
   - Wet bulb temperature calculation accuracy
   - Kong WBGT calculation with Visual Crossing inputs

### Integration Tests
1. **Live API Tests** (conditional with flag):
   - Fetch 7 days of data for Sydney
   - Verify response structure
   - Check query cost calculation
   - Validate station attribution

2. **End-to-End Tests**:
   - `/observations` with various time ranges
   - Automatic tier routing (3 days, 30 days, 100 days)
   - Combined Visual Crossing + solar → WBGT output
   - Error responses for invalid ranges

### Manual Testing Checklist
- [ ] Sydney Olympic Park: 5 days ago (Tier 2 - Visual Crossing)
- [ ] Sydney Olympic Park: 30 days ago (Tier 2 - Visual Crossing)
- [ ] Sydney Olympic Park: 60 days ago (Tier 2 - Visual Crossing)
- [ ] Sydney Olympic Park: 100 days ago (Tier 3 - should redirect to historic)
- [ ] Custom lat/lon near Sydney: Tier 2 routing
- [ ] Rate limit: Multiple large queries in one day
- [ ] Query cost tracking: Verify counter increments correctly

---

## Implementation Phases

### Phase 0: Kong Zero-Iteration Psychrometric Wet Bulb 🔥 COMPLETE ✅
**Status**: All Tiers Complete | Production-Ready
**Completed**: All tasks finished, unit tests passing, validation complete

**Objective**: Replace model data and approximations with Kong's zero-iteration psychrometric wet bulb calculation across all tiers.

**Background**: Currently using:
- Tier 1 (BOM): No explicit Tw (relies on Kong calculation internally)
- Tier 2 (Visual Crossing): Stull 2011 approximation (±1°C accuracy)
- Tier 3 (Historic): Open-Meteo `wet_bulb_temperature_2m` (ERA5 model data)

**Target**: Use Kong & Huber (2024) zero-iteration calculation for pure observational wet bulb across all tiers.

**Reference**: https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2024GH001068

**Tasks**:
- [x] **COMPLETE** - Tier 3 (Historic): Implemented in `src/utils/historical-fetcher.ts`
  - ✅ Removed Open-Meteo `wet_bulb_temperature_2m` dependency
  - ✅ Added psychrometric wet bulb calculation using Kong method
  - ✅ No longer retrieves `wet_bulb_temperature_2m` from archive API
  - ✅ Uses shared `calculatePsychrometricWetBulb()` function

- [x] **COMPLETE** - Move to shared module: `src/calculations/kong-wbgt.ts`
  - ✅ Consolidated to single export: `calculatePsychrometricWetBulb(Ta, RH, P)`
  - ✅ Exposed via `src/calculations/index.ts` for easy importing
  - ✅ Full TypeScript documentation with JSDoc comments
  - Reference: https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2024GH001068

- [x] **COMPLETE** - Remove from URL parameters:
  - ✅ Tier 1 (BOM): No Open-Meteo calls request `wet_bulb_temperature_2m`
  - ✅ Tier 3 (Historic): Archive API does not request `wet_bulb_temperature_2m`
  - ✅ Verified: Only requests temperature, humidity, dew point, pressure, wind, cloud cover

- [x] **COMPLETE** - Update Tier 1 (BOM) to use shared Kong calculation:
  - ✅ Removed local `calculatePsychrometricWetBulb()` function from `src/index.ts`
  - ✅ Imported shared function via `src/calculations/index.ts`
  - ✅ All calls updated to use shared implementation
  - ✅ No Open-Meteo `wet_bulb_temperature_2m` references

- [x] **COMPLETE** - Update Tier 3 (Historic) to use shared Kong calculation:
  - ✅ Removed local `calculatePsychrometricWetBulb()` method from `HistoricalFetcher` class
  - ✅ Imported shared function from `../calculations/kong-wbgt`
  - ✅ Updated method calls from `this.calculatePsychrometricWetBulb()` to direct function calls

- [x] **COMPLETE** - Add unit tests for Kong psychrometric wet bulb calculation:
  - ✅ Created `src/calculations/__tests__/kong-wbgt.test.ts`
  - ✅ Tests cover typical conditions, edge cases, extreme temperatures
  - ✅ Validates wet bulb < dry bulb, saturated air behavior, pressure variations
  - ✅ Tests convergence and accuracy against known psychrometric values

- [x] **COMPLETE** - Validate accuracy against known wet bulb values:
  - ✅ Verified against psychrometric chart values within ±1°C
  - ✅ Tested: Ta=30°C/RH=50% → Tw≈22.5°C, Ta=20°C/RH=70% → Tw≈16.5°C
  - ✅ All test cases pass with expected ranges

**Benefits**:
- ✅ Pure observational data (no model data dependency)
- ✅ Better accuracy than Stull approximation
- ✅ Consistent methodology across all tiers
- ✅ Reduced API calls to Open-Meteo (one less parameter)

---

### Phase 1: Core Integration 📋 NEXT (After Phase 0)
**Estimated Time**: 2-3 hours

- [ ] Create `src/utils/visual-crossing-fetcher.ts`
- [ ] Implement API fetching with error handling
- [ ] Implement response parsing (days → hours → observations)
- [ ] Implement rate limiting and daily reset logic
- [ ] ~~Add wet bulb temperature calculation~~ (Use Kong calculation from Phase 0)
- [ ] Add conversion to hourly arrays format

### Phase 2: Endpoint Routing 📋
**Estimated Time**: 1-2 hours

- [ ] Update `handleGetObservations()` in `src/index.ts`
- [ ] Add tier detection logic based on data age
- [ ] Implement Visual Crossing + solar data combination
- [ ] Add error responses for Tier 3 redirect
- [ ] Update response metadata (source, stations, query cost)

### Phase 3: Testing & Validation 📋
**Estimated Time**: 2-3 hours

- [ ] Write unit tests for Visual Crossing fetcher
- [ ] Write integration tests for tier routing
- [ ] Manual testing with real API calls
- [ ] Verify WBGT calculation accuracy vs BOM (where overlap)
- [ ] Performance testing (response times)

### Phase 4: Deployment & Monitoring 📋
**Estimated Time**: 1 hour

- [ ] Add Visual Crossing API key to Cloudflare Workers environment
- [ ] Deploy to production
- [ ] Monitor query costs and rate limit usage
- [ ] Verify all three tiers working correctly
- [ ] Update API documentation

---

## Success Criteria

### Functional Requirements
- ✅ Seamless 3-tier routing based on data age
- ✅ Visual Crossing integration for 3-90 day range
- ✅ Accurate WBGT calculations from Visual Crossing + solar data
- ✅ Proper error handling and user guidance
- ✅ Rate limit management stays within free tier for normal use

### Data Quality Requirements
- ✅ <0.5°C WBGT difference vs BOM where data overlaps (days 3-4)
- ✅ Multi-station aggregation provides better accuracy than single station
- ✅ >95% observational data (minimal model data usage)
- ✅ Station attribution included in responses

### Performance Requirements
- ✅ <2 seconds response time for 7-day request
- ✅ <5 seconds response time for 30-day request
- ✅ Efficient query cost usage (<720 records for 30-day request)
- ✅ Stay within 1000 records/day free tier for typical usage

### Operational Requirements
- ✅ Clear error messages for all failure modes
- ✅ Query cost tracking and warning system
- ✅ Graceful degradation if Visual Crossing unavailable
- ✅ Comprehensive logging for debugging

---

## Cost Projections

### Typical Usage Scenarios

**Scenario 1: Single User, Daily Queries**
- Query: Last 7 days hourly data
- Records: 7 × 24 = 168 records
- Frequency: 1/day
- Daily cost: FREE (168 < 1000 free tier)
- Monthly cost: $0

**Scenario 2: Multiple Users, Moderate Load**
- Query: Last 30 days hourly data
- Records: 30 × 24 = 720 records
- Frequency: 2/day
- Daily records: 1440 (440 over free tier)
- Daily cost: 440 × $0.0001 = $0.044 (4.4 cents)
- Monthly cost: ~$1.32

**Scenario 3: Heavy Analysis, Batch Processing**
- Query: Last 60 days hourly data
- Records: 60 × 24 = 1440 records
- Frequency: 3/day
- Daily records: 4320 (3320 over free tier)
- Daily cost: 3320 × $0.0001 = $0.332 (33.2 cents)
- Monthly cost: ~$10

### Cost Optimization Strategies
1. **Cache results** for frequently requested ranges
2. **Batch user requests** when possible
3. **Use daily data** instead of hourly for overview queries (reduce records by 24×)
4. **Implement query result caching** with 1-hour TTL

---

## Future Enhancements

### Near-term (Optional)
- **Caching Layer**: Cache Visual Crossing responses with 1-hour TTL
- **Batch Optimization**: Combine multiple user requests into single API call
- **Query Cost Dashboard**: Track usage patterns and optimize

### Long-term (Nice to Have)
- **Daily Data Option**: Add `resolution=daily` parameter to reduce costs
- **Multiple Providers**: Add fallback to IEM if Visual Crossing unavailable
- **Global Expansion**: Extend beyond Sydney using Visual Crossing's global coverage
- **Data Quality Metrics**: Compare Visual Crossing vs BOM accuracy in overlap period

---

## References

### API Documentation
- Visual Crossing Timeline API: https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/
- Visual Crossing Data Sources: https://www.visualcrossing.com/resources/documentation/weather-data/weather-data-sources-and-attribution/
- Open-Meteo Solar Radiation: https://open-meteo.com/en/docs/historical-weather-api

### Existing Implementation Patterns
- `src/utils/historical-fetcher.ts`: NOAA ISD + solar combination (template for Visual Crossing)
- `src/calculations/kong-wbgt.ts`: Kong WBGT calculation pipeline
- `src/utils/station-finder.ts`: BOM station selection logic (reference for distance calculations)

### Research & Decisions
- `SUMMARY.md`: Detailed research findings and decision rationale

---

**Document Version**: 1.0
**Created**: November 19, 2025
**Status**: Ready for Implementation
**Next Action**: Phase 1 - Create `visual-crossing-fetcher.ts` module
