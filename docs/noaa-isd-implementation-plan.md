# NOAA ISD Implementation Plan

## Overview

This document outlines the implementation plan for integrating NOAA Integrated Surface Database (ISD) observational data into the WBGT historical fetcher.

---

## Architecture

### Data Priority System

```
┌─────────────────────────────────────────────────────┐
│         Historic Observations Request               │
│  (start_date, end_date, latitude, longitude)        │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│         Priority 1a: NOAA ISD Weather Data         │
│  • Find nearest station(s) by coordinates          │
│  • Fetch from S3: s3://noaa-isd-pds/data/YYYY/...  │
│  • Parse fixed-width format                        │
│  • Extract: temp, humidity, pressure, wind         │
│  • Status: ✅ OBSERVATIONAL                        │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│     Priority 1b: Satellite Solar Radiation         │
│  • satellite-api.open-meteo.com                    │
│  • Extract: SR_instant, SR_direct, SR_diffuse      │
│  • Validate: check for zeros during daylight       │
│  • Status: ✅ OBSERVATIONAL (Already Implemented)  │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│       Priority 2: Open-Meteo Archive               │
│  • archive-api.open-meteo.com                      │
│  • Used only when ISD or satellite unavailable     │
│  • Status: ⚠️ MODEL DATA (Fallback)                │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│          Combine & Calculate WBGT                  │
│  • Calculate wet bulb from temp + humidity + pres  │
│  • Run Kong WBGT pipeline                          │
│  • Return with data_sources metadata               │
└────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── utils/
│   ├── historical-fetcher.ts          # Main coordinator (update)
│   ├── noaa-isd/
│   │   ├── stations.ts                # Station lookup & cache (NEW)
│   │   ├── parser.ts                  # ISD format parser (NEW)
│   │   ├── fetcher.ts                 # S3 fetch & decompress (NEW)
│   │   └── types.ts                   # TypeScript interfaces (NEW)
│   └── psychrometrics.ts              # Wet bulb calculations (check if exists)
└── data/
    └── isd-stations-cache.json        # Cached station metadata (generated)
```

---

## Implementation Phases

### Phase 1: Station Lookup Service

**File**: `src/utils/noaa-isd/stations.ts`

```typescript
// Types
interface ISDStation {
  usaf: string;
  wban: string;
  name: string;
  country: string;
  state: string;
  icao: string;
  latitude: number;
  longitude: number;
  elevation: number;
  begin: Date;
  end: Date;
}

interface StationSearchResult {
  station: ISDStation;
  distance_km: number;
}

// Main functions
export class ISDStationFinder {
  private stations: ISDStation[] = [];

  // Load station list from cache or fetch from NOAA
  async loadStations(): Promise<void>

  // Find nearest N stations by coordinates
  findNearestStations(
    latitude: number,
    longitude: number,
    maxDistance: number = 100, // km
    limit: number = 3
  ): StationSearchResult[]

  // Check if station has data for date range
  hasDataForRange(station: ISDStation, startDate: string, endDate: string): boolean

  // Get station ID for S3 path
  getStationId(station: ISDStation): string // returns "USAF-WBAN"
}
```

**Data Source**:
- URL: https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt
- Format: Fixed-width text (parse with substring indices)
- Cache: Store parsed JSON in memory/KV store for fast lookups

**Implementation Notes**:
- isd-history.txt format (from NOAA docs):
  ```
  Columns:
  1-6     USAF
  8-12    WBAN
  14-42   STATION NAME
  44-45   CTRY (Country)
  48-49   ST (State)
  52-56   ICAO
  58-64   LAT (decimal degrees * 1000)
  66-73   LON (decimal degrees * 1000)
  75-81   ELEV (meters * 10)
  83-90   BEGIN (YYYYMMDD)
  92-99   END (YYYYMMDD)
  ```

---

### Phase 2: ISD Data Parser

**File**: `src/utils/noaa-isd/parser.ts`

```typescript
// Types
interface ISDObservation {
  timestamp: string;          // ISO format in UTC
  temperature?: number;       // °C
  dew_point?: number;        // °C
  sea_level_pressure?: number; // hPa
  wind_speed?: number;       // m/s
  wind_direction?: number;   // degrees
  cloud_cover?: number;      // oktas (0-8)
  quality_flag: string;      // Quality indicator
}

interface ISDHourlyData {
  station_id: string;
  observations: ISDObservation[];
  data_quality: 'good' | 'fair' | 'poor';
}

// Main parser
export class ISDParser {
  // Parse control section (first 105 characters)
  parseControlSection(line: string): {
    timestamp: string;
    station_id: string;
  }

  // Parse mandatory data section (characters 106+)
  parseMandatoryData(line: string): {
    temperature?: number;
    dew_point?: number;
    sea_level_pressure?: number;
    wind_speed?: number;
    wind_direction?: number;
  }

  // Parse additional data section (variable length)
  parseAdditionalData(line: string): {
    cloud_cover?: number;
    // other fields as needed
  }

  // Main parsing function
  parseISDFile(fileContent: string): ISDHourlyData

  // Quality filtering
  filterByQuality(observations: ISDObservation[]): ISDObservation[]
}
```

**ISD Format Reference** (simplified for core fields):
```
Position  Field                  Format
---------  --------------------  -------
1-4       Total variable length  9999
5-10      USAF station ID        999999
11-15     WBAN station ID        99999
16-23     Observation date       YYYYMMDD
24-27     Observation time       HHmm
...
87-92     Air temperature        +9999 (scaled by 10, in °C)
93-93     Air temp quality       9
94-98     Dew point             +9999 (scaled by 10, in °C)
99-99     Dew point quality     9
100-104   Sea level pressure    99999 (scaled by 10, in hPa)
105-105   SLP quality           9
```

---

### Phase 3: S3 Fetcher

**File**: `src/utils/noaa-isd/fetcher.ts`

```typescript
export class ISDFetcher {
  private readonly S3_BASE = 'https://noaa-isd-pds.s3.amazonaws.com/data';

  // Build S3 URL for station and year
  buildS3Url(usafWban: string, year: number): string {
    // Example: https://noaa-isd-pds.s3.amazonaws.com/data/2024/723150-03812-2024.gz
    return `${this.S3_BASE}/${year}/${usafWban}-${year}.gz`;
  }

  // Fetch and decompress ISD file from S3
  async fetchISDFile(usafWban: string, year: number): Promise<string> {
    const url = this.buildS3Url(usafWban, year);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ISD file: ${response.status}`);
    }

    // Decompress using Cloudflare Workers DecompressionStream
    const decompressed = response.body
      ?.pipeThrough(new DecompressionStream('gzip'));

    const reader = decompressed?.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    return result;
  }

  // Fetch multiple years if date range spans years
  async fetchDateRange(
    usafWban: string,
    startDate: string,
    endDate: string
  ): Promise<ISDObservation[]>
}
```

**Notes**:
- Cloudflare Workers natively support `DecompressionStream` for gzip
- No external dependencies needed
- S3 bucket is publicly accessible (no credentials required)

---

### Phase 4: Integration with HistoricalFetcher

**File**: `src/utils/historical-fetcher.ts` (update existing)

```typescript
import { ISDStationFinder } from './noaa-isd/stations';
import { ISDFetcher } from './noaa-isd/fetcher';
import { ISDParser } from './noaa-isd/parser';

export class HistoricalFetcher {
  private stationFinder = new ISDStationFinder();
  private isdFetcher = new ISDFetcher();
  private isdParser = new ISDParser();

  async fetchKongWBGTByTimezone(
    startDate: string,
    endDate: string,
    latitude: number,
    longitude: number,
    timezone: string = 'auto'
  ): Promise<any[]> {

    console.log(`[HISTORIC] Fetching observational data for ${startDate} to ${endDate}`);

    // Priority 1a: Try NOAA ISD observational data
    let weatherData: any = null;
    let weatherSource: string = 'none';

    try {
      await this.stationFinder.loadStations();
      const nearestStations = this.stationFinder.findNearestStations(
        latitude, longitude, 100, 3
      );

      if (nearestStations.length > 0) {
        const station = nearestStations[0].station;
        console.log(`[ISD] Using station ${station.name} (${nearestStations[0].distance_km.toFixed(1)} km away)`);

        const stationId = this.stationFinder.getStationId(station);
        const isdObservations = await this.isdFetcher.fetchDateRange(
          stationId, startDate, endDate
        );

        const parsedData = this.isdParser.parseISDFile(isdObservations);
        weatherData = this.convertISDToWeatherData(parsedData, timezone);
        weatherSource = 'isd';
        console.log(`[ISD] Successfully fetched ${parsedData.observations.length} observations`);
      }
    } catch (error) {
      console.error('[ISD] Error fetching ISD data, will fallback to archive:', error);
    }

    // Fallback to Open-Meteo archive if ISD failed
    if (!weatherData) {
      console.log(`[HISTORIC] Falling back to Open-Meteo archive (model data)`);
      const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?...`;
      const response = await fetch(weatherUrl);
      weatherData = await response.json();
      weatherSource = 'archive';
    }

    // Priority 1b: Satellite solar radiation (already implemented)
    const satelliteData = await this.fetchSatelliteRadiation(startDate, endDate, latitude, longitude);
    let solarSource = satelliteData ? 'satellite' : 'archive';

    // Extract weather arrays
    const times = weatherData?.hourly?.time || [];
    const temps = weatherData?.hourly?.temperature_2m || [];
    const humidity = weatherData?.hourly?.relative_humidity_2m || [];
    // ... (rest of existing code)

    // Add to results
    results.push({
      timestamp: localTimestamp,
      temperature: parseFloat(Ta.toFixed(1)),
      // ... other fields
      weather_source: weatherSource,  // NEW: 'isd' or 'archive'
      solar_source: solarSource,      // Existing: 'satellite' or 'archive'
    });

    return results;
  }

  // Helper: Convert ISD observations to Open-Meteo-like format
  private convertISDToWeatherData(isdData: ISDHourlyData, timezone: string): any {
    // Map ISD observations to hourly arrays matching Open-Meteo structure
    // This allows seamless integration with existing Kong WBGT pipeline
  }
}
```

---

## Data Flow Example

### Request
```
GET /api/historic_observations?start_date=2024-07-01&end_date=2024-07-02&latitude=-33.8018&longitude=151.1254
```

### Processing
1. **Station Lookup**: Find nearest ISD station (e.g., Sydney Airport - 947670-99999)
2. **ISD Fetch**: GET https://noaa-isd-pds.s3.amazonaws.com/data/2024/947670-99999-2024.gz
3. **Decompress**: Gunzip file content
4. **Parse**: Extract hourly observations for July 1-2
5. **Satellite Fetch**: GET satellite-api.open-meteo.com (for solar radiation)
6. **Calculate**: Wet bulb from temp + humidity + pressure
7. **Kong WBGT**: Run calculation pipeline
8. **Return**: JSON with `weather_source: 'isd'` and `solar_source: 'satellite'`

### Response
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "01/07/2024, 00:00:00",
      "temperature": 14.2,
      "humidity": 76,
      "dew_point": 10.1,
      "wind_speed_ms": 3.6,
      "solar_radiation": 0.0,
      "cloud_cover": 4.5,
      "wbgt": 12.8,
      "esi": 13.1,
      "apparent_temp": 13.5,
      "weather_source": "isd",
      "solar_source": "satellite"
    },
    // ... more observations
  ],
  "count": 48,
  "location": { "latitude": -33.8018, "longitude": 151.1254 },
  "station": {
    "name": "SYDNEY AIRPORT",
    "id": "947670-99999",
    "distance_km": 8.3
  },
  "timezone": "auto",
  "data_quality": {
    "weather": "observational",
    "solar": "observational"
  },
  "note": "Using NOAA ISD observational weather data + satellite solar radiation"
}
```

---

## Testing Strategy

### Unit Tests
- Station distance calculations
- ISD format parsing (various data quality scenarios)
- Wet bulb temperature calculations
- Data quality filtering

### Integration Tests
- Fetch real ISD data from S3
- Parse and validate against known good values
- Compare WBGT results with current Open-Meteo implementation
- Test fallback logic when ISD unavailable

### Validation Locations
- Sydney Airport (947670-99999) - well-instrumented
- Tokyo (476710-99999) - international coverage test
- Rural location with no nearby stations - fallback test

---

## Rollout Plan

### Stage 1: Development (Week 1)
- Implement station finder
- Implement ISD parser
- Implement S3 fetcher
- Add unit tests

### Stage 2: Integration (Week 2)
- Integrate with HistoricalFetcher
- Add fallback logic
- Integration testing
- Validation against current system

### Stage 3: Beta (Week 3)
- Deploy with feature flag
- Monitor data quality
- Compare with Open-Meteo baseline
- Collect performance metrics

### Stage 4: Production (Week 4)
- Enable by default
- Update documentation
- Monitor for issues
- Performance optimization

---

## Performance Considerations

### Caching Strategy
- Cache station list in Workers KV (update weekly)
- Cache parsed ISD data for recently requested dates
- Use Cloudflare Cache API for S3 responses

### Optimization
- Parallel fetching: Weather (ISD) + Solar (satellite) simultaneously
- Lazy station loading: Only load stations near requested coordinates
- Stream parsing: Don't load entire file into memory

### Estimated Latency
- Station lookup: ~5-10ms (with cache)
- S3 fetch + decompress: ~200-500ms
- Parsing: ~50-100ms
- Total ISD overhead: ~300-600ms
- **Acceptable** compared to current ~200ms for Open-Meteo

---

## Monitoring & Alerting

### Metrics to Track
- ISD fetch success rate
- Fallback rate (ISD → Open-Meteo)
- Data quality distribution
- Station coverage by region
- Response time by data source

### Logging
```typescript
console.log('[ISD] Station: ${stationName}, Distance: ${distance}km');
console.log('[ISD] Observations: ${count}, Quality: ${quality}');
console.log('[ISD] Fetch time: ${duration}ms');
```

---

## Future Enhancements

1. **Multiple Station Blending**: Average multiple nearby stations for better accuracy
2. **Quality Scoring**: Weight stations by data quality and recency
3. **Station Preference**: Allow users to specify preferred station IDs
4. **Real-time Updates**: Extend to recent observations (not just historical)
5. **Alternative Sources**: Add support for other observational networks (e.g., METAR, SYNOP)

---

## Conclusion

This implementation plan provides a clear path to integrating NOAA ISD observational data into the WBGT historical fetcher. The tiered approach ensures:

✅ **Observational priority**: Real weather data preferred over model data
✅ **Robust fallback**: Graceful degradation to Open-Meteo when needed
✅ **Performance**: Acceptable latency with caching strategies
✅ **Maintainability**: Clean separation of concerns with modular code
✅ **Transparency**: Clear metadata about data sources used

Estimated total development time: **10-13 hours** for a production-ready implementation.
