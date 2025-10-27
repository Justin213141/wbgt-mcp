# Timezone Handling Summary: wbgt-mcp-server

This document describes how timezones are handled across the entire WBGT calculation pipeline, from API requests through calculation to output formatting.

---

## Overview

The system supports **two primary timezones**:
- **Sydney, Australia** (UTC+10/+11 with DST)
- **Tokyo, Japan** (UTC+9, no DST)

Timezone handling occurs at **four critical points** in the pipeline:

1. **API Data Fetching** - Request data in local timezone
2. **Solar Zenith Calculation** - Convert local time to UTC for accurate solar angles
3. **WBGT Calculation** - Use calculated solar angles in heat stress formulas
4. **Result Output** - Format timestamps in local timezone

---

## Important Note: BOM Data (Sydney Only)

**BOM (Bureau of Meteorology) is Australia-only** and plays a special role in recent observations:

| Type | Data Source | Timezone | Frequency | Use Case |
|------|---|---|---|---|
| **Recent Observations** | BOM + Open-Meteo | Sydney local (UTC+10/11) | 30-minute (BOM) / Hourly (OM) | Last 72 hours |
| **Recent Forecast** | BOM + Open-Meteo | UTC | Hourly | 3-day forecast |
| **Historical Data** | Open-Meteo Archive | Configurable (Sydney/Tokyo) | Hourly | Any date range |
| **Japan Data** | Open-Meteo only | Asia/Tokyo | Hourly | Historical only |

**BOM Timestamps:**
- Observations: `local_date_time_full` = "20251027110000" (AEST, Sydney local)
- Forecast: `time` = "2025-10-27T07:00:00Z" (UTC)

**Key Constraint:** BOM observations are 30-minute frequency, requiring special matching with hourly Open-Meteo data. This is NOT handled by the unified timezone functions and is managed separately in parse functions.

---

## 1. API Data Fetching (Step 1)

### Current Observations (Recent Data - 72 hours)

**Endpoint:** Open-Meteo API with `timezone=Australia/Sydney`

```typescript
// src/index.ts:1045-1090 (fetchObservations)
const weatherUrl = `https://api.open-meteo.com/v1/forecast?
  latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&
  timezone=Australia%2FSydney&
  hourly=temperature_2m,relative_humidity_2m,shortwave_radiation_instant,...`
```

**Key Point:** The `timezone` parameter tells Open-Meteo to return timestamps in **Sydney local time**.

**Response Format:**
```json
{
  "hourly": {
    "time": ["2025-10-11T08:00", "2025-10-11T09:00", ...],
    "temperature_2m": [25, 26, ...],
    ...
  }
}
```

**Timestamps are in:** Sydney local time (e.g., 8:00 AM = Sydney morning)

---

### Historical Data (Archive - any date range)

**Function:** `fetchKongWBGT(startDate, endDate, latitude, longitude)`
**Endpoint:** Open-Meteo Archive API with `timezone=Australia/Sydney`

```typescript
// src/index.ts:838-856
const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?
  latitude=${latitude}&longitude=${longitude}&
  start_date=${startDate}&end_date=${endDate}&
  timezone=Australia%2FSydney&
  hourly=temperature_2m,relative_humidity_2m,...`
```

**Response:** Timestamps in Sydney local time

---

**Function:** `fetchKongWBGTJapan(startDate, endDate, latitude, longitude)`
**Endpoint:** Open-Meteo Archive API with `timezone=Asia/Tokyo`

```typescript
// src/index.ts:941-959
const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?
  latitude=${latitude}&longitude=${longitude}&
  start_date=${startDate}&end_date=${endDate}&
  timezone=Asia%2FTokyo&
  hourly=temperature_2m,relative_humidity_2m,...`
```

**Response:** Timestamps in Tokyo local time (JST)

---

## 2. Solar Zenith Calculation (Step 2)

### Why Solar Calculations Need Timezone Awareness

Solar zenith angle depends on **exact UTC time**, which varies by timezone. A timestamp of "10:00" means different UTC times depending on location:
- Sydney 10:00 → UTC 23:59 (previous day) or UTC 00:00 (if EDT)
- Tokyo 10:00 → UTC 01:00 (same calendar day)

### Unified Function: `calculateSolarZenithAngleByTimezone()`

```typescript
// src/calculations/solar/solar-geometry.ts:10-24
export function calculateSolarZenithAngleByTimezone(
  lat: number,
  lon: number,
  timestamp: string,
  utcOffset: number,      // 10 for Sydney, 9 for Tokyo
  hasDST: boolean         // true for Sydney, false for Tokyo
): number {
  if (utcOffset === 10 && hasDST) {
    return calculateSolarZenithAngle(lat, lon, timestamp);
  }
  if (utcOffset === 9 && !hasDST) {
    return calculateSolarZenithAngleJST(lat, lon, timestamp);
  }
  throw new Error("Unsupported timezone");
}
```

### Sydney Implementation: `calculateSolarZenithAngle()`

```typescript
// src/calculations/solar/solar-geometry.ts:33-108
export function calculateSolarZenithAngle(
  lat: number,
  lon: number,
  timestamp: string  // Format: "2025-10-11T08:00" (Sydney local)
): number {
  // Parse Sydney local time: "2025-10-11T08:00"
  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));
  const [hour, minute] = timePart.split(':').map(x => parseInt(x, 10));

  // Determine Sydney DST status
  // Sydney uses EDT (UTC+11) from first Sunday in October to first Sunday in April
  // EDT from Oct 5 - Apr 6 in 2025
  const isDST = month >= 10 || month <= 3;
  const sydneyUTCOffset = isDST ? 11 : 10;

  // Convert Sydney local time → UTC
  // Sydney = UTC + offset, so UTC = Sydney - offset
  let utcHour = hour - sydneyUTCOffset;  // Subtract hours
  let utcDay = day;
  // ... handle day rollover if utcHour < 0

  // Calculate solar declination and hour angle using UTC time
  const decl = 23.45 * Math.sin(B);
  const hourAngle = 15 * (solarTime - 12);

  // Calculate zenith angle
  const zenithDeg = zenithRad * 180 / Math.PI;
  return Math.max(0, Math.min(180, zenithDeg));
}
```

**Key Steps:**
1. **Parse local timestamp** (Sydney time)
2. **Determine DST status** (Oct-Apr = EDT, Apr-Oct = EST)
3. **Convert to UTC** by subtracting timezone offset
4. **Calculate solar angles** using UTC time
5. **Return zenith angle** (0-180°)

### Tokyo Implementation: `calculateSolarZenithAngleJST()`

```typescript
// src/calculations/solar/solar-geometry.ts:117-185
export function calculateSolarZenithAngleJST(
  lat: number,
  lon: number,
  timestamp: string  // Format: "2025-10-11T08:00" (JST/Tokyo local)
): number {
  // Parse JST local time: "2025-10-11T08:00"
  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));
  const [hour, minute] = timePart.split(':').map(x => parseInt(x, 10));

  // Japan uses JST (UTC+9) year-round - no daylight saving time
  const jstUTCOffset = 9;

  // Convert JST local time → UTC
  let utcHour = hour - jstUTCOffset;  // Subtract 9 hours
  // ... handle day rollover

  // Calculate solar declination and hour angle using UTC time
  // ... (same calculations as Sydney version)

  return Math.max(0, Math.min(180, zenithDeg));
}
```

**Key Difference from Sydney:**
- JST offset is always UTC+9 (no DST)
- Simpler conversion (no DST calculation needed)

---

## 3. WBGT Calculation Pipeline (Step 3)

### Unified Function: `calculateKongWBGTPipelineByTimezone()`

```typescript
// src/calculations/kong-wbgt.ts:106-216
export function calculateKongWBGTPipelineByTimezone(
  Ta, Tw, RH, P_hPa, u10m, SRdown, SRdirect, SRdiffuse,
  lat, lon, timestamp,
  utcOffset: number = 10,   // Default: Sydney
  hasDST: boolean = true    // Default: Sydney with DST
): {
  kong_wbgt: number;
  black_globe_temp: number;
  natural_wet_bulb_temp: number;
  solar_zenith_angle: number;
  esi: number;
  intermediate: { ... };
} {
  // Step 1: Solar geometry (timezone-aware)
  const theta_deg = calculateSolarZenithAngleByTimezone(
    lat, lon, timestamp, utcOffset, hasDST
  );

  // Step 2: Validate sun position
  const isSunAboveHorizon = theta_deg <= 90;
  const SRdown_valid = isSunAboveHorizon ? SRdown : 0;
  const SRdirect_valid = isSunAboveHorizon ? SRdirect : 0;
  const SRdiffuse_valid = isSunAboveHorizon ? SRdiffuse : 0;

  // Step 3: Atmospheric parameters
  const Ta_K = Ta + 273.15;
  const P_Pa = P_hPa * 100;
  const esat_Ta = calculateBuckSaturationVaporPressure(Ta);
  const ea_actual = (RH / 100) * esat_Ta;

  // Step 4: Radiation components
  const { SRg, LRg, SRw, LRw } = calculateRadiationComponents(
    Ta, SRdown_valid, SRdirect_valid, SRdiffuse_valid, ea_actual, theta_deg
  );

  // Step 5: Air properties
  const u2m = calculateWindAt2m(u10m);
  const airProps = calculateAirProperties(Ta_K, P_Pa);

  // Step 6: Heat transfer coefficients
  const coefficients = calculateHeatTransferCoefficients(
    Ta, Tw, P_Pa, u2m, airProps
  );

  // Step 7: Temperature calculations (using radiation)
  const T_g = calculateKongBlackGlobe(Ta, SRg, LRg, coefficients.h_cg, coefficients.h_rg);
  const T_nw = calculateKongNaturalWetBulb(Ta, Tw, SRw, LRw, ea_actual, ...);

  // Step 8: Final WBGT
  const wbgt = calculateKongWBGT(Ta, T_g, T_nw);
  const esi = calculateESI(Ta, RH, SRdown);

  return { kong_wbgt: wbgt, ... };
}
```

**Call Flow:**
```
calculateKongWBGTPipelineByTimezone()
├─ calculateSolarZenithAngleByTimezone()  ← TIMEZONE-AWARE
│  ├─ calculateSolarZenithAngle()         (Sydney)
│  └─ calculateSolarZenithAngleJST()      (Tokyo)
├─ calculateRadiationComponents()
├─ calculateHeatTransferCoefficients()
├─ calculateKongBlackGlobe()
├─ calculateKongNaturalWetBulb()
└─ calculateKongWBGT()
```

### Legacy Functions (Still Supported)

**Sydney-specific:** `calculateKongWBGTPipeline()`
```typescript
// src/calculations/kong-wbgt.ts:221-322
// Internally calls calculateSolarZenithAngle() (hardcoded Sydney)
```

**Tokyo-specific:** `calculateKongWBGTPipelineJST()`
```typescript
// src/calculations/kong-wbgt.ts:[not shown but similar]
// Internally calls calculateSolarZenithAngleJST() (hardcoded Tokyo)
```

These are used directly by:
- `fetchKongWBGT()` for Sydney historical data
- `fetchKongWBGTJapan()` for Tokyo historical data

---

## 4. Result Output & Formatting (Step 4)

### Historical Data Output

**Sydney (fetchKongWBGT):**
```typescript
// src/index.ts:909-914
// Archive API with timezone=Australia/Sydney returns Sydney local time
// time format: "2025-10-24T11:00" (Sydney local)
const [datePart, timePart] = time.split('T');
const [year, month, day] = datePart.split('-');
const localTimestamp = `${day}/${month}/${year}, ${timePart}:00`;
// Output: "24/10/2025, 11:00:00" (Sydney time)

results.push({
  timestamp: localTimestamp,
  temperature: parseFloat(Ta.toFixed(1)),
  wbgt: parseFloat(kongCalc.kong_wbgt.toFixed(1)),
  ...
});
```

**Tokyo (fetchKongWBGTJapan):**
```typescript
// src/index.ts:1012-1017
// Archive API with timezone=Asia/Tokyo returns JST local time
// time format: "2025-10-24T11:00" (JST local)
const [datePart, timePart] = time.split('T');
const [year, month, day] = datePart.split('-');
const localTimestamp = `${day}/${month}/${year}, ${timePart}:00`;
// Output: "24/10/2025, 11:00:00" (JST time)

results.push({
  timestamp: localTimestamp,
  ...
});
```

**Key Point:** Timestamps are formatted in the **original API timezone** (no conversion back).

### Recent Observations Output

```typescript
// src/index.ts (parseForecastData, parseObservations, etc.)
// Uses same pattern: keep timestamps from API as-is in Sydney local time
results.push({
  timestamp: ISO_timestamp_from_API,  // Already in Sydney local time
  ...
});
```

---

## Timezone Configuration Reference

| Aspect | Sydney | Tokyo |
|--------|--------|-------|
| **Timezone** | Australia/Sydney | Asia/Tokyo |
| **UTC Offset** | UTC+10 (EST) / UTC+11 (EDT) | UTC+9 (JST) |
| **DST** | Oct 5 - Apr 6 (EDT = UTC+11) | None (always UTC+9) |
| **Solar Function** | `calculateSolarZenithAngle()` | `calculateSolarZenithAngleJST()` |
| **Kong Function** | `calculateKongWBGTPipeline()` | `calculateKongWBGTPipelineJST()` |
| **Historical Fetch** | `fetchKongWBGT()` | `fetchKongWBGTJapan()` |
| **API Timezone Param** | `timezone=Australia%2FSydney` | `timezone=Asia%2FTokyo` |
| **Unified Params** | `utcOffset=10, hasDST=true` | `utcOffset=9, hasDST=false` |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT: Local Timestamp                    │
│                  "2025-10-11T08:00" (local)                 │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
    ┌───▼────────────────────┐    ┌──────▼──────────────────┐
    │   Sydney (UTC+10/11)   │    │   Tokyo (UTC+9)        │
    ├───────────────────────┤    ├──────────────────────┤
    │ 1. Parse local time   │    │ 1. Parse local time │
    │ 2. Determine DST      │    │ 2. No DST logic     │
    │ 3. UTC = Local - 11   │    │ 3. UTC = Local - 9  │
    │    or Local - 10      │    │                     │
    │ 4. Solar calc (UTC)   │    │ 4. Solar calc (UTC) │
    │ 5. Kong calc w/ angle │    │ 5. Kong calc w/ angle
    │ 6. Output local time  │    │ 6. Output local time
    └───┬────────────────────┘    └──────┬──────────────────┘
        │                                 │
        └────────────────┬────────────────┘
                         │
        ┌────────────────▼────────────────┐
        │  OUTPUT: Formatted Results      │
        │  WBGT, ESI, Timestamp (local)   │
        └─────────────────────────────────┘
```

---

## Critical Timestamp Handling Rules

### ✅ DO's

1. **Always store timestamps in local timezone from API**
   ```typescript
   // Open-Meteo returns "2025-10-11T08:00" in the requested timezone
   // Store and output it as-is
   ```

2. **Convert to UTC only for solar calculations**
   ```typescript
   // Solar zenith depends on UTC time
   const utcHour = localHour - utcOffset;
   ```

3. **Use unified timezone-aware functions**
   ```typescript
   calculateSolarZenithAngleByTimezone(lat, lon, timestamp, utcOffset, hasDST);
   calculateKongWBGTPipelineByTimezone(Ta, Tw, ..., utcOffset, hasDST);
   ```

### ❌ DON'Ts

1. **Don't convert timestamps after receiving from API**
   ```typescript
   // ❌ WRONG: API already returned Sydney time
   // NO: const utcTime = new Date(sydneyTime); // Causes double conversion
   ```

2. **Don't use JavaScript Date object for timezone conversions**
   ```typescript
   // ❌ WRONG: JS Date uses browser/server timezone
   // NO: const d = new Date("2025-10-11T08:00"); // Ambiguous!
   ```

3. **Don't mix timezone offsets without DST consideration**
   ```typescript
   // ❌ WRONG: Sydney is UTC+10, but UTC+11 during DST
   // NO: utcOffset = 10  // Always wrong Apr-Oct
   ```

4. **Don't assume UTC+9 for all Asia timezones**
   ```typescript
   // ❌ WRONG: China uses UTC+8, Korea uses UTC+9
   // NO: if (asia) utcOffset = 9;  // Too simplistic
   ```

---

## Extension for New Timezones

To add support for a new timezone (e.g., New York, UTC-5/-4):

### 1. Create solar calculation function
```typescript
// src/calculations/solar/solar-geometry.ts
export function calculateSolarZenithAngleEST(
  lat: number,
  lon: number,
  timestamp: string
): number {
  // Parse local time
  const isDST = month >= 3 && month <= 10;  // EDT Mar-Nov
  const estUTCOffset = isDST ? 4 : 5;

  // Convert to UTC
  let utcHour = hour + estUTCOffset;  // Add (not subtract)

  // Calculate solar angle
  // ... (same calculation pattern)
}
```

### 2. Update unified solar function
```typescript
// src/calculations/solar/solar-geometry.ts
export function calculateSolarZenithAngleByTimezone(
  lat: number,
  lon: number,
  timestamp: string,
  utcOffset: number,
  hasDST: boolean
): number {
  // ... existing Sydney and Tokyo checks

  if (utcOffset === -5 && hasDST) {
    return calculateSolarZenithAngleEST(lat, lon, timestamp);
  }
}
```

### 3. Create Kong calculation function
```typescript
// src/calculations/kong-wbgt.ts
export function calculateKongWBGTPipelineEST(...) { }
```

### 4. Create fetch function
```typescript
// src/index.ts
async function fetchKongWBGTNewYork(
  startDate: string,
  endDate: string,
  latitude: number,
  longitude: number
): Promise<any[]> {
  const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?
    ...&timezone=America%2FNew_York&...`;
  // Use calculateKongWBGTPipelineEST or unified function with params
}
```

---

## Phase 2 Impact: Timezone Handling Improvements

### Before Consolidation
- **108 lines duplicated** between Sydney and Tokyo Kong functions
- **62 lines duplicated** between Sydney and Tokyo solar functions
- **Hard to maintain:** Changing calculation logic requires updating two versions

### After Consolidation
- **`calculateSolarZenithAngleByTimezone()`** - Single entry point with timezone delegation
- **`calculateKongWBGTPipelineByTimezone()`** - Single entry point with timezone delegation
- **Easier to extend:** Adding new timezone requires only new solar + Kong functions, not duplicating existing logic
- **Backward compatible:** Legacy functions (`calculateSolarZenithAngle`, `calculateKongWBGTPipeline`, etc.) still work

---

## Summary

**Timezone handling in wbgt-mcp-server:**

1. **API Level:** Request data in local timezone (Sydney/Tokyo) - API returns local timestamps
2. **Solar Calculation:** Convert local time → UTC for accurate solar zenith angles
3. **WBGT Calculation:** Use solar angles + weather data in heat stress formulas
4. **Output:** Return results with timestamps in original local timezone

**Key Unified Functions:**
- `calculateSolarZenithAngleByTimezone(lat, lon, timestamp, utcOffset, hasDST)`
- `calculateKongWBGTPipelineByTimezone(Ta, Tw, RH, P_hPa, u10m, SRdown, SRdirect, SRdiffuse, lat, lon, timestamp, utcOffset, hasDST)`

**Supported Timezones:**
- Sydney: UTC+10/+11 (EDT Oct-Apr)
- Tokyo: UTC+9 (no DST)
- Extensible for future timezones

