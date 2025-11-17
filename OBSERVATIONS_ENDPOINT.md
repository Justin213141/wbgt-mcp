# /observations/ Endpoint Documentation

## Overview

The `/api/observations` endpoint retrieves WBGT (Wet Bulb Globe Temperature) observations from the past 72 hours for Sydney using the Kong calculation method with advanced radiation and heat transfer modeling.

## Endpoint Details

### Primary Endpoints
- **Recommended**: `GET /api/observations`
- **Legacy**: `GET /api/v1/observations` (deprecated)

### HTTP Method
`GET`

## Functionality

### Core Features

1. **Recent Observations Retrieval**
   - Fetches WBGT data from the past 72 hours
   - Uses the Kong WBGT calculation method for accuracy
   - Combines data from multiple authoritative sources

2. **Activity Time Window Analysis**
   - Optional time range filtering using `start_time` and `end_time` parameters
   - Returns maximum WBGT values during the specified activity window
   - Useful for retrospective analysis of athletic events or outdoor activities

3. **Data Interpolation**
   - When no exact data exists in the requested time range, uses closest observations
   - Conservative approach: selects higher WBGT value for athlete safety
   - Marks interpolated results with metadata

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_time` | string (ISO 8601) | No | Start time for activity-specific WBGT maximum (e.g., `2025-10-27T10:00:00Z`) |
| `end_time` | string (ISO 8601) | No | End time for activity window. When both start and end time are provided, returns max WBGT during the window |

## Data Sources

The endpoint integrates data from multiple sources:

1. **Open-Meteo API**
   - Temperature, humidity, pressure
   - Wind speed
   - Solar radiation (instant, direct, diffuse components)
   - Cloud cover and UV index
   - Wet bulb temperature

2. **BOM (Bureau of Meteorology Australia)**
   - Air temperature and relative humidity
   - Dew point
   - Wind speed
   - Local observations for Sydney

## Calculations Performed

### Kong WBGT Method
Advanced calculation using:
- Wet bulb temperature
- Solar radiation components (direct, diffuse, reflected)
- Heat transfer coefficients
- Globe temperature modeling
- Solar zenith angle calculations

### Additional Metrics
- **ESI (Environmental Stress Index)**: Heat stress indicator
- **Apparent Temperature**: "Feels like" temperature
- **Standard WBGT**: Fallback calculation when detailed data unavailable

## Response Format

### Success Response (Without Time Window)

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "27/10/2025, 12:00:00",
      "temperature": 28.5,
      "humidity": 65,
      "dew_point": 20.2,
      "wind_speed_ms": 3.2,
      "solar_radiation": 450.0,
      "cloud_cover": 25.0,
      "uv_index": 6.0,
      "wbgt": 26.3,
      "esi": 24.1,
      "apparent_temp": 31.2
    }
    // ... more observations
  ],
  "count": 72,
  "timestamp": "2025-10-27T12:00:00Z",
  "note": "Past 72-hour WBGT observations (Kong method)"
}
```

### Success Response (With Time Window)

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-10-27T10:00:00 to 2025-10-27T14:00:00",
      "temperature": 29.8,
      "humidity": 65,
      "dew_point": 21.5,
      "wind_speed_ms": 3.5,
      "solar_radiation": 520.0,
      "cloud_cover": 20.0,
      "uv_index": 7.0,
      "wbgt": 27.5,
      "esi": 25.2,
      "apparent_temp": 32.1
    }
  ],
  "count": 1,
  "timestamp": "2025-10-27T14:30:00Z",
  "note": "Max WBGT conditions during activity from 2025-10-27T10:00:00 to 2025-10-27T14:00:00"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "FETCH_FAILED",
    "message": "Failed to fetch observations",
    "details": {
      "reason": "Network timeout"
    }
  },
  "timestamp": "2025-10-27T12:00:00Z",
  "path": "/api/observations"
}
```

## Response Fields

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `timestamp` | string | - | Observation time (DD/MM/YYYY, HH:MM:SS format for Sydney local time) |
| `temperature` | number | °C | Air temperature |
| `humidity` | number | % | Relative humidity (0-100) |
| `dew_point` | number | °C | Dew point temperature |
| `wind_speed_ms` | number | m/s | Wind speed in meters per second |
| `solar_radiation` | number | W/m² | Solar radiation intensity |
| `cloud_cover` | number | % | Cloud cover percentage |
| `uv_index` | number | - | UV index |
| `wbgt` | number | °C | Wet Bulb Globe Temperature (Kong method) |
| `esi` | number | °C | Environmental Stress Index |
| `apparent_temp` | number | °C | Apparent temperature ("feels like") |

## Use Cases

### 1. Current Conditions Analysis
```
GET /api/observations
```
Returns all observations from the past 72 hours

### 2. Activity-Specific Maximum WBGT
```
GET /api/observations?start_time=2025-10-27T10:00:00Z&end_time=2025-10-27T14:00:00Z
```
Returns the maximum WBGT observed during a specific activity window (e.g., a sporting event)

### 3. Recent Trend Analysis
```
GET /api/observations
```
Analyze the full 72-hour dataset to identify heat stress patterns and trends

## Implementation Details

### Data Processing Pipeline

1. **Fetch Recent Data**
   - Open-Meteo: Past 3 days with hourly data
   - BOM: Recent observations for Sydney

2. **Build Data Maps**
   - Create hourly lookup maps for Open-Meteo data
   - Normalize BOM timestamps to ISO format
   - Match observations by hour key

3. **Calculate WBGT**
   - Apply Kong WBGT pipeline with:
     - Vapor pressure calculations
     - Solar zenith angle
     - Radiation components
     - Heat transfer coefficients
     - Black globe temperature
     - Natural wet bulb temperature

4. **Filter by Time Range** (if specified)
   - Find observations within the time window
   - Calculate maximum values across all parameters
   - Apply interpolation fallback if no exact matches

5. **Format Response**
   - Convert timestamps to Sydney local time
   - Round values to appropriate precision
   - Add metadata and notes

### Special Handling

- **BOM Timestamp Normalization**: Handles multiple timestamp formats (14-digit compact, DD/HH:MMam/pm, ISO)
- **Solar Radiation Lookup**: Matches BOM observations with Open-Meteo radiation data by hour
- **Fallback Calculations**: Uses simplified WBGT when detailed data unavailable
- **Conservative Interpolation**: Selects higher WBGT when data is outside the requested window

## Location

**Fixed Location**: Sydney, Australia
- Latitude: -33.8018
- Longitude: 151.1254
- Timezone: Australia/Sydney

*Note: For custom locations, use the `/api/historic_observations` endpoint with latitude/longitude parameters*

## Related Endpoints

- **Current WBGT**: `/api/current` - Single most recent observation
- **Forecast**: `/api/forecast` - 72-hour future predictions
- **Historical Data**: `/api/historic_observations` - Custom date ranges and locations
- **Japan Historical**: `/api/historic_observations_japan` - Japan-specific data with JST timezone

## MCP Tool Integration

This endpoint is also available as an MCP tool:

**Tool Name**: `get_observations`

**Description**: Get past 72 hours of WBGT observations for Sydney using Kong method

**Schema**:
```typescript
{
  start_time?: string;  // Optional ISO format timestamp
  end_time?: string;    // Optional ISO format timestamp
}
```

## Technical Notes

1. **Caching**: API responses from external sources are cached for 5 minutes
2. **Calculation Method**: Kong zero-iteration method with detailed radiation modeling
3. **Precision**: Temperature values rounded to 1 decimal place, percentages to integers
4. **Data Age Limit**: Only returns past 72 hours (API limitation from Open-Meteo)
5. **Error Handling**: Returns partial data if one source fails, with appropriate error messaging

## References

- Kong WBGT Method: Advanced heat stress calculation with radiation and heat transfer
- Open-Meteo API: https://api.open-meteo.com
- Bureau of Meteorology: Australian weather observations
- WBGT Standard: ISO 7243:2017 (Hot environments)
