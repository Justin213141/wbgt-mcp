# WBGT MCP Server API Documentation

## Overview

The WBGT MCP Server provides dual protocol access to comprehensive heat stress index calculations:

- **MCP Tools**: For Model Context Protocol integration
- **HTTP REST API**: For web service integration
- **Kong WBGT Algorithm**: Zero-iteration analytic implementation with numerical safeguards

## Protocol Support

### Model Context Protocol (MCP) Tools
For integration with MCP clients (Claude, etc.)

### HTTP REST API
For web service integration with standard HTTP requests
- **Base URL**: `https://wbgt-mcp-server.your-domain.workers.dev`
- **OpenAPI Spec**: `/api/docs/openapi.yaml`
- **Health Check**: `/api/health`

---

## MCP Tools

### 1. get_current_wbgt

**Description**: Get current WBGT conditions for Sydney with comprehensive heat stress assessment

**Parameters**: None (hardcoded for Sydney location)

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T14:30:00Z",
    "location": {
      "lat": -33.8688,
      "lon": 151.2093,
      "name": "Sydney"
    },
    "weather": {
      "temperature": 30.2,
      "relative_humidity": 65,
      "wind_speed": 2.5,
      "solar_radiation": 800,
      "pressure": 1013.25
    },
    "wbgt": {
      "value": 28.5,
      "level": "High",
      "risk_assessment": "Moderate to high heat stress"
    },
    "kong_wbgt": {
      "kong_wbgt": 28.5,
      "black_globe_temp": 45.1,
      "natural_wet_bulb_temp": 26.8,
      "esi": 24.2
    }
  }
}
```

### 2. get_wbgt_forecast

**Description**: 72-hour WBGT forecast with full weather data

**Parameters**: None

**Response**: Hourly forecast array with:
```json
{
  "success": true,
  "data": [
    {
      "time": "2024-01-15T15:00:00Z",
      "temperature": 30.5,
      "relative_humidity": 63,
      "wbgt": 29.1,
      "kong_wbgt": 29.1,
      "solar_radiation": 750,
      "wind_speed": 2.2
    }
  ]
}
```

### 3. get_observations

**Description**: Past 72-hour observations with location support

**Parameters**:
- `lat` (number, optional): Latitude for custom location
- `lon` (number, optional): Longitude for custom location

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-01-15T12:00:00Z",
      "temperature": 29.8,
      "relative_humidity": 68,
      "wbgt": 27.9,
      "kong_wbgt": 27.9
    }
  ],
  "metadata": {
    "location": { "lat": -33.8688, "lon": 151.2093 },
    "source": "open_meteo",
    "quality": "high"
  }
}
```

### 4. get_historic_observations

**Description**: Historical data with timezone and date range support

**Parameters**:
- `start_date` (string): ISO 8601 start date
- `end_date` (string): ISO 8601 end date
- `timezone` (string, optional): Timezone identifier
- `lat` (number, optional): Latitude
- `lon` (number, optional): Longitude

**Response**: Historical observations array with comprehensive metadata

---

## HTTP REST API

### Base Endpoints

#### GET /api/current
Get current WBGT conditions for a location

**Parameters**:
- `lat` (number): Latitude (-90 to 90)
- `lon` (number): Longitude (-180 to 180)

**Example**:
```
GET /api/current?lat=-33.8688&lon=151.2093
```

**Response**:
```json
{
  "success": true,
  "wbgt": 28.5,
  "air_temperature": 30.2,
  "relative_humidity": 65,
  "black_globe_temperature": 45.1,
  "natural_wet_bulb_temperature": 26.8,
  "timestamp": "2024-01-15T14:30:00Z",
  "location": {
    "lat": -33.8688,
    "lon": 151.2093
  },
  "heat_stress_level": "High"
}
```

#### GET /api/forecast
72-hour WBGT forecast with safety assessments

**Parameters**:
- `lat` (number): Latitude
- `lon` (number): Longitude

**Response**:
```json
{
  "success": true,
  "forecast": [
    {
      "time": "2024-01-15T15:00:00Z",
      "wbgt": 29.1,
      "confidence": 0.92,
      "risk_level": "Moderate"
    }
  ],
  "summary": {
    "peak_wbgt": 32.1,
    "high_risk_hours": 3,
    "safety_recommendations": ["Frequent breaks", "Increased hydration"]
  }
}
```

#### GET /api/observations
Recent observations with 2-tier data source routing

**Parameters**:
- `lat` (number, optional): Location latitude
- `lon` (number, optional): Location longitude
- `hours` (number, optional): Hours of data (default: 72)

**Response**:
```json
{
  "success": true,
  "observations": [
    {
      "timestamp": "2024-01-15T13:00:00Z",
      "temperature": 29.5,
      "relative_humidity": 66,
      "wbgt": 28.1,
      "data_source": "weatherzone",
      "quality": "high"
    }
  ],
  "metadata": {
    "data_source": "weatherzone",
    "station_info": {
      "id": "SYDNEY",
      "name": "Sydney Observatory Hill",
      "distance_km": 2.1
    }
  }
}
```

#### GET /api/historic_observations
Historical data with timezone support

**Parameters**:
- `start_date` (string): ISO 8601 start date
- `end_date` (string): ISO 8601 end date
- `lat` (number, optional): Latitude
- `lon` (number, optional): Longitude
- `timezone` (string, optional): Timezone identifier

**Example**:
```
GET /api/historic_observations?start_date=2024-01-01T00:00:00Z&end_date=2024-01-07T23:59:59Z
```

### Alternative Data Sources

#### GET /api/VC_observations
Visual Crossing data for 3-90 day range

**Parameters**:
- `start_date` (string): Start date
- `end_date` (string): End date
- `lat` (number): Latitude
- `lon` (number): Longitude

#### GET /api/meteostat_observations
Meteostat historical data

**Parameters**:
- `start_date` (string): Start date
- `end_date` (string): End date
- `lat` (number): Latitude
- `lon` (number): Longitude

#### GET /api/experimental/weatherzone_observations
WeatherZone Australian data

**Parameters**:
- `station_id` (string): WeatherZone station ID

### Documentation & Health

#### GET /api/docs/openapi.yaml
OpenAPI specification in YAML format

#### GET /api/docs/openapi.json
OpenAPI specification in JSON format

#### GET /api/health
Health check endpoint

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T14:30:00Z",
  "version": "1.0.0",
  "uptime": 86400
}
```

---

## Data Models

### WBGTObservation
```typescript
interface WBGTObservation {
  timestamp: string;
  temperature?: number;
  relative_humidity?: number;
  wbgt?: number;
  kong_wbgt?: KongWBGTResult;
  black_globe_temperature?: number;
  natural_wet_bulb_temperature?: number;
  esi?: number;
  data_source?: string;
  quality?: 'high' | 'medium' | 'low';
}
```

### KongWBGTResult
```typescript
interface KongWBGTResult {
  kong_wbgt: number;
  black_globe_temp: number;
  natural_wet_bulb_temp: number;
  solar_zenith_angle: number;
  esi: number;
  intermediate: {
    vapor_pressure: number;
    atmospheric_emissivity: number;
    direct_fraction: number;
  };
}
```

### HeatStressLevel
```typescript
type HeatStressLevel = 'Low' | 'Moderate' | 'High' | 'Extreme';
```

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Invalid latitude or longitude provided",
    "details": "Latitude must be between -90 and 90, longitude between -180 and 180"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_PARAMETERS` | Invalid request parameters | 400 |
| `LOCATION_NOT_FOUND` | Location outside data coverage | 404 |
| `DATA_UNAVAILABLE` | No data available for requested period | 404 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

---

## Usage Examples

### JavaScript/Node.js

```javascript
// Current WBGT
const response = await fetch('/api/current?lat=-33.8688&lon=151.2093');
const data = await response.json();
console.log('Current WBGT:', data.wbgt);

// Forecast
const forecast = await fetch('/api/forecast?lat=-33.8688&lon=151.2093');
const forecastData = await forecast.json();

// Historical
const historic = await fetch('/api/historic_observations?start_date=2024-01-01T00:00:00Z&end_date=2024-01-07T23:59:59Z');
const historicData = await historic.json();
```

### Python

```python
import requests

# Current WBGT
response = requests.get('https://wbgt-server.workers.dev/api/current',
                        params={'lat': -33.8688, 'lon': 151.2093})
data = response.json()
print(f"Current WBGT: {data['wbgt']}°C")

# Forecast
forecast = requests.get('/api/forecast', params={'lat': -33.8688, 'lon': 151.2093})
forecast_data = forecast.json()

# Historical observations
historic = requests.get('/api/observations', params={
    'start_date': '2024-01-01T00:00:00Z',
    'end_date': '2024-01-07T23:59:59Z'
})
```

### MCP Client Configuration

```json
{
  "mcpServers": {
    "wbgt": {
      "command": "node",
      "args": ["./src/index.js"],
      "env": {
        "VISUAL_CROSSING_API_KEY": "your-api-key"
      }
    }
  }
}
```

---

## Performance & Limitations

### Rate Limits
- **Free Tier**: 1000 requests/day
- **Premium**: Configurable based on requirements
- **Burst**: 100 requests/minute

### Response Times
- **Current Conditions**: <100ms
- **72-hour Forecast**: <200ms
- **Historical Data**: <500ms (depending on date range)

### Data Coverage
- **Current Data**: Global with enhanced coverage in Australia
- **Historical Data**: 1970-present (Visual Crossing)
- **Forecast Data**: 72 hours with hourly granularity

### Accuracy
- **Temperature**: ±0.5°C
- **Humidity**: ±3%
- **WBGT**: ±0.8°C (after numerical safeguards)
- **Wind Speed**: ±0.5 m/s

---

## Testing

### API Testing
```bash
# Health check
curl https://wbgt-server.workers.dev/api/health

# Current WBGT for Sydney
curl "https://wbgt-server.workers.dev/api/current?lat=-33.8688&lon=151.2093"

# Historical data
curl "https://wbgt-server.workers.dev/api/historic_observations?start_date=2024-01-01T00:00:00Z&end_date=2024-01-07T23:59:59Z"
```

### Integration Testing
- **Unit Tests**: All calculation functions validated
- **Integration Tests**: API endpoints tested with real data
- **Load Tests**: Performance validated under high load
- **Error Handling**: Comprehensive error scenario testing

---

## Support

For API support and issues:
1. Check this documentation first
2. Review error messages for common issues
3. Contact support with request details and timestamps
4. Include location coordinates for location-specific issues

---

## Changelog

For detailed version history and changes, see the main [CHANGELOG.md](../CHANGELOG.md).

Key API changes in v1.0.0:
- Added numerical stability safeguards to all calculations
- Implemented 1.0 m/s wind speed floor
- Added comprehensive input validation
- Enhanced error reporting and status codes
- Improved response formats with confidence scores