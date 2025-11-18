# NOAA ISD Integration Research for WBGT MCP

## Executive Summary

This document outlines research findings for integrating NOAA Integrated Surface Database (ISD) observational data into the WBGT Cloudflare Worker's historic_observations endpoint.

**Key Finding**: Direct S3 access to raw NOAA ISD data is possible but complex. Third-party APIs (Meteostat, Visual Crossing) provide easier access but have rate limits and restrictions.

---

## NOAA ISD Overview

### What is NOAA ISD?

The Integrated Surface Database (ISD) is NOAA's comprehensive database of global hourly and synoptic weather observations compiled from multiple sources.

**Coverage**:
- 35,000+ weather stations worldwide
- Historical data dating back to 1901
- 14,000+ active stations with daily updates

**Key Parameters Available**:
- ✅ Temperature (dry bulb)
- ✅ Dew point temperature
- ✅ Relative humidity (derived)
- ✅ Wind speed and direction
- ✅ Atmospheric pressure (sea level, station, altimeter)
- ✅ Precipitation
- ✅ Cloud cover
- ❌ **Solar radiation** (NOT available - must use satellite data separately)
- ❌ Wet bulb temperature (must calculate from temp + humidity + pressure)

---

## Access Methods Comparison

### Option 1: Direct S3 Access (AWS noaa-isd-pds)

**Location**: `s3://noaa-isd-pds/`
**Region**: us-east-1
**Access**: Public bucket (no AWS credentials required)

#### Structure
```
/data/YYYY/USAF-WBAN-YEAR.gz

Example:
/data/2024/723150-03812-2024.gz
       └─ Year  └─ USAF  └─ WBAN
```

#### Station Metadata
- **Station List**: https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt
- **Format**: Fixed-width text file
- **Fields**: USAF, WBAN, Country, State, ICAO, Lat/Lon, Elevation, Begin/End dates

#### Data Format
- **Format**: Gzipped fixed-width text format
- **Documentation**: https://www.ncei.noaa.gov/data/global-hourly/doc/isd-format-document.pdf
- **Complexity**: High - requires parsing complex fixed-width format

#### Pros
✅ Free, unlimited access
✅ Most comprehensive data
✅ No rate limits
✅ Complete control over data processing
✅ Works well with Cloudflare Workers (can fetch from S3 directly)

#### Cons
❌ Complex parsing required (fixed-width format)
❌ Must implement station lookup logic
❌ Must handle data quality flags
❌ Gzip decompression needed
❌ Significant development time
❌ Need to map closest station to coordinates

---

### Option 2: Meteostat API

**Website**: https://dev.meteostat.net/
**Type**: Free API wrapper around NOAA/DWD/other sources

#### Endpoints
```
GET /stations/nearby?lat={lat}&lon={lon}&limit=10
GET /stations/hourly?station={id}&start={YYYY-MM-DD}&end={YYYY-MM-DD}
```

#### Rate Limits
- **Direct API** (api.meteostat.net): 200 requests/hour/key
- **RapidAPI** (via RapidAPI marketplace): 500 requests/month (free tier)
- **Constraint**: Max 30 days per hourly data request

#### Data Fields
```json
{
  "time": "2024-01-01 12:00:00",
  "temp": 15.5,
  "dwpt": 10.2,
  "rhum": 70,
  "prcp": 0,
  "snow": null,
  "wdir": 180,
  "wspd": 12.5,
  "wpgt": null,
  "pres": 1013.2,
  "tsun": null,
  "coco": null
}
```

#### Pros
✅ Simple JSON API
✅ Station lookup by coordinates
✅ Free tier available
✅ Handles data quality/aggregation
✅ Easy Cloudflare Worker integration

#### Cons
❌ Rate limits (200/hour or 500/month)
❌ 30-day query limit
❌ Non-commercial use only
❌ May not have all stations
❌ No wet bulb temperature
❌ Dependent on third-party service

---

### Option 3: Visual Crossing Weather API

**Website**: https://www.visualcrossing.com/
**Type**: Commercial API (uses NOAA ISD + other sources)

#### Features
- Processes NOAA ISD data into easier format
- Blends observations with model data for complete coverage
- JSON/CSV/Excel output formats
- Historical + forecast data

#### Pricing
- **Free tier**: 1,000 records/day
- **Paid tiers**: Starting at $0.0001 per record
- Commercial use allowed

#### Pros
✅ Clean JSON API
✅ Handles data gaps intelligently
✅ Better coverage (blends obs + model)
✅ Commercial use allowed
✅ May include calculated fields (wet bulb)

#### Cons
❌ Costs money for production use
❌ Not pure observational (blends model data)
❌ Less control over data sources
❌ Vendor lock-in

---

## Implementation Recommendations

### Recommended Approach: **Hybrid Tiered System**

Implement a tiered data fetching system in `src/utils/historical-fetcher.ts`:

```
Priority 1a: NOAA ISD observational weather data (direct S3 access)
Priority 1b: Satellite solar radiation (already implemented ✅)
Priority 2:  Open-Meteo archive (model data, fallback only)
```

### Why Direct S3 Access?

1. **No rate limits** - Critical for production API
2. **Free forever** - Public AWS bucket
3. **Most accurate** - Direct from source
4. **Best for research** - Pure observational data
5. **Future-proof** - Not dependent on third-party APIs

### Implementation Strategy

#### Phase 1: Station Lookup Service
Create `src/utils/noaa-isd-stations.ts`:
- Download and cache isd-history.txt
- Implement spatial search (find nearest station by coordinates)
- Filter by date availability and data quality

#### Phase 2: ISD Data Parser
Create `src/utils/noaa-isd-parser.ts`:
- Fetch gzipped data from S3
- Decompress using Cloudflare Workers' DecompressionStream
- Parse fixed-width format for required fields:
  - Temperature (mandatory field)
  - Dew point (mandatory field)
  - Pressure (mandatory field)
  - Wind speed (mandatory field)
  - Cloud cover (additional data)

#### Phase 3: Integration
Update `HistoricalFetcher.fetchKongWBGTByTimezone()`:
```typescript
1. Fetch satellite solar radiation (already implemented)
2. Find nearest ISD station(s) by coordinates
3. Fetch ISD hourly observations from S3
4. Parse and extract weather variables
5. Calculate wet bulb from temp + humidity + pressure
6. If ISD data unavailable, fallback to Open-Meteo archive
7. Combine ISD weather + satellite solar for WBGT calculation
```

---

## Required Data Fields for WBGT Calculation

### Currently Required (from Kong WBGT pipeline):
1. **Air Temperature (Ta)** - °C
2. **Wet Bulb Temperature (Tw)** - °C (must calculate from ISD data)
3. **Relative Humidity (RH)** - %
4. **Surface Pressure (P)** - hPa
5. **Wind Speed (u)** - m/s
6. **Solar Radiation** (SR_down, SR_direct, SR_diffuse) - W/m² (from satellite)

### ISD Data Mapping:
| WBGT Field | ISD Field | Status |
|------------|-----------|--------|
| Ta | TMP (Air Temperature) | ✅ Available |
| RH | Calculate from TMP + DEW | ✅ Derivable |
| Tw | Calculate from TMP + RH + SLP | ✅ Derivable |
| P | SLP (Sea Level Pressure) | ✅ Available |
| u | WND (Wind Speed) | ✅ Available |
| SR | N/A | ❌ Use satellite API |
| Cloud Cover | SKY (Sky Condition) | ✅ Available |

---

## Technical Challenges & Solutions

### Challenge 1: Complex Fixed-Width Format
**Solution**: Create a robust parser based on official format spec. Focus on mandatory fields only initially.

### Challenge 2: Data Quality Flags
**Solution**: Implement quality filtering. Skip records with poor quality indicators.

### Challenge 3: Station Selection
**Solution**: Use spatial indexing (k-d tree or simple distance calculation) to find nearest station(s) with data availability.

### Challenge 4: Missing Data
**Solution**: Implement graceful fallback to Open-Meteo archive when ISD data unavailable or poor quality.

### Challenge 5: Wet Bulb Calculation
**Solution**: Use existing psychrometric calculations (already in codebase for Open-Meteo data).

---

## Alternative: Meteostat for Quick Prototype

If development time is constrained, Meteostat could work as an interim solution:

```typescript
// Quick prototype with Meteostat
async fetchMeteostatData(lat: number, lon: number, startDate: string, endDate: string) {
  // 1. Find nearest station
  const stationsResp = await fetch(
    `https://api.meteostat.net/v2/stations/nearby?lat=${lat}&lon=${lon}&limit=5`,
    { headers: { 'X-Api-Key': 'YOUR_KEY' } }
  );

  // 2. Fetch hourly data
  const dataResp = await fetch(
    `https://api.meteostat.net/v2/stations/hourly?station=${stationId}&start=${startDate}&end=${endDate}`,
    { headers: { 'X-Api-Key': 'YOUR_KEY' } }
  );

  // 3. Map to WBGT inputs
  // ...
}
```

**Limitations**:
- Rate limits (200/hour) may be insufficient for production
- 30-day query limit requires multiple requests for long ranges
- Non-commercial use restriction

---

## Recommended Next Steps

1. ✅ **Start with Direct S3 Approach** - Best long-term solution
2. Create station lookup utility (isd-history.txt parser)
3. Implement ISD fixed-width parser for core fields
4. Add to tiered fetching logic in HistoricalFetcher
5. Validate against current Open-Meteo results
6. Add data source tracking to response (`weather_source: 'isd'`)

## Timeline Estimate

- **Station lookup service**: 2-3 hours
- **ISD parser (core fields)**: 4-6 hours
- **Integration + testing**: 3-4 hours
- **Total**: ~10-13 hours development time

---

## References

- NOAA ISD Documentation: https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database
- ISD Format Spec: https://www.ncei.noaa.gov/data/global-hourly/doc/isd-format-document.pdf
- Station List: https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt
- S3 Bucket: s3://noaa-isd-pds/
- Meteostat API Docs: https://dev.meteostat.net/
- Visual Crossing: https://www.visualcrossing.com/

---

## Conclusion

**Direct NOAA ISD S3 access** is the recommended approach for integrating observational weather data. While it requires more initial development effort than using Meteostat or Visual Crossing APIs, it provides:

- Unlimited, free access
- Pure observational data (not blended with models)
- No rate limits or vendor dependencies
- Complete control over data quality and processing

Combined with the already-implemented satellite solar radiation, this creates a robust dual-priority observational data system for historical WBGT calculations.
