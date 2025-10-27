# API Reference - WBGT Sydney Runner

Quick reference guide for HTTP and MCP endpoint integration.

## Quick Start

### HTTP Base URL
```
https://wbgt-mcp-server.workers.dev
```

### MCP Server
```
Connection: SSE via /sse or /mcp endpoints
Protocol: Model Context Protocol v2024-11-05
```

---

## HTTP Endpoints

### Current Conditions
```bash
GET /api/current
```
Returns current WBGT, temperature, humidity, solar radiation for Sydney.

**Example:**
```bash
curl https://wbgt-mcp-server.workers.dev/api/current
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-10-27T12:00:00Z",
    "temperature": 28.5,
    "humidity": 65,
    "dew_point": 20.2,
    "wind_speed_ms": 3.2,
    "solar_radiation": 450,
    "cloud_cover": 25,
    "uv_index": 6,
    "wbgt": 26.3,
    "esi": 24.1,
    "apparent_temp": 31.2
  },
  "timestamp": "2025-10-27T12:00:00Z",
  "note": "Current WBGT conditions in Sydney"
}
```

---

### 72-Hour Forecast
```bash
GET /api/forecast
```
Returns 72 hourly forecast entries with WBGT predictions.

**Example:**
```bash
curl https://wbgt-mcp-server.workers.dev/api/forecast
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-10-27T13:00:00Z",
      "temperature": 29.1,
      "humidity": 62,
      "wbgt": 26.8,
      "solar_radiation": 480
    },
    // ... 71 more entries
  ],
  "count": 72,
  "timestamp": "2025-10-27T12:00:00Z",
  "note": "WBGT forecast (72 hours)"
}
```

---

### Past 72-Hour Observations
```bash
GET /api/observations
```
Returns past 72 hours of WBGT observations (Kong method).

**Optional Parameters:**
- `start_time` - ISO format (e.g., `2025-10-27T10:00:00Z`)
- `end_time` - ISO format. When both provided, returns max WBGT during window

**Example:**
```bash
# All past 72 hours
curl https://wbgt-mcp-server.workers.dev/api/observations

# Max WBGT during activity window
curl "https://wbgt-mcp-server.workers.dev/api/observations?start_time=2025-10-27T10:00:00Z&end_time=2025-10-27T14:00:00Z"
```

---

### Historical Data (Custom Dates & Locations)
```bash
GET /api/historic_observations
```
Returns WBGT data for any date range and location.

**Required Parameters:**
- `start_date` - YYYY-MM-DD format
- `end_date` - YYYY-MM-DD format (cannot be today)

**Optional Parameters:**
- `latitude` - Default: -33.8018 (Sydney)
- `longitude` - Default: 151.1254 (Sydney)

**Example:**
```bash
# Sydney data for date range
curl "https://wbgt-mcp-server.workers.dev/api/historic_observations?start_date=2025-10-01&end_date=2025-10-26"

# Custom location
curl "https://wbgt-mcp-server.workers.dev/api/historic_observations?start_date=2025-10-01&end_date=2025-10-26&latitude=-33.8683&longitude=151.2093"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-10-01T00:00:00Z",
      "temperature": 24.5,
      "humidity": 70,
      "wbgt": 22.1
    }
  ],
  "count": 1,
  "location": {
    "latitude": -33.8018,
    "longitude": 151.1254
  },
  "timestamp": "2025-10-27T12:00:00Z"
}
```

---

### Historical Data (Japan - JST Timezone)
```bash
GET /api/historic_observations_japan
```
Returns WBGT data for Japan locations (JST timezone).

**Required Parameters:**
- `start_date` - YYYY-MM-DD format
- `end_date` - YYYY-MM-DD format
- `latitude` - Japan location latitude
- `longitude` - Japan location longitude

**Example:**
```bash
# Tokyo data
curl "https://wbgt-mcp-server.workers.dev/api/historic_observations_japan?start_date=2025-10-01&end_date=2025-10-26&latitude=35.6762&longitude=139.6503"
```

---

### Health Check
```bash
GET /api/health
```
Service status endpoint.

**Example:**
```bash
curl https://wbgt-mcp-server.workers.dev/api/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "WBGT Sydney Runner API",
  "timestamp": "2025-10-27T12:00:00Z"
}
```

---

### API Documentation
```bash
GET /api
```
View available endpoints and API version information.

---

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "field": "parameter_name",
      "constraint": "validation_rule"
    }
  },
  "timestamp": "2025-10-27T12:00:00Z",
  "path": "/api/endpoint"
}
```

**Common Error Codes:**
- `MISSING_REQUIRED_PARAMETERS` - Missing required query parameters
- `FETCH_FAILED` - Failed to fetch data from external API
- `ENDPOINT_NOT_FOUND` - Endpoint does not exist
- `INTERNAL_SERVER_ERROR` - Server error

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - Not found
- `500` - Server error

---

## CORS Support

All HTTP endpoints support CORS:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Content-Type: application/json`

**Browser Integration Example:**
```javascript
const response = await fetch('https://wbgt-mcp-server.workers.dev/api/current');
const data = await response.json();
console.log(data.data.wbgt);
```

---

## MCP Server Integration

### Connection Methods

**Option 1: SSE (Server-Sent Events)**
```
SSE Endpoint: https://wbgt-mcp-server.workers.dev/sse
Protocol: Model Context Protocol
```

**Option 2: Standard MCP**
```
Endpoint: https://wbgt-mcp-server.workers.dev/mcp
Protocol: Model Context Protocol
```

### MCP Tools Available

The server exposes MCP tools that mirror HTTP endpoints:

1. **get-current-wbgt**
   - Get current WBGT conditions
   - No parameters required
   - Returns current data for Sydney

2. **get-forecast**
   - Get 72-hour WBGT forecast
   - No parameters required
   - Returns array of forecast entries

3. **get-observations**
   - Get past 72 hours of observations
   - Optional: `start_time`, `end_time`
   - Returns array of observations

4. **get-historic-observations**
   - Get historical WBGT data
   - Required: `start_date`, `end_date` (YYYY-MM-DD)
   - Optional: `latitude`, `longitude`
   - Returns historical data for specified range

5. **get-historic-observations-japan**
   - Get historical WBGT data for Japan
   - Required: `start_date`, `end_date`, `latitude`, `longitude`
   - Returns data in JST timezone

### Claude Integration

To use with Claude Desktop, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wbgt": {
      "url": "https://wbgt-mcp-server.workers.dev/sse"
    }
  }
}
```

---

## Common Use Cases

### Case 1: Current Heat Stress Check
```bash
curl https://wbgt-mcp-server.workers.dev/api/current | jq '.data.wbgt'
```
Returns current WBGT value (Celsius).

### Case 2: Activity Safety Planning
```bash
curl "https://wbgt-mcp-server.workers.dev/api/observations?start_time=2025-10-27T14:00:00Z&end_time=2025-10-27T18:00:00Z" | jq '.data[].wbgt'
```
Get max WBGT during event time window.

### Case 3: Historical Analysis
```bash
curl "https://wbgt-mcp-server.workers.dev/api/historic_observations?start_date=2025-01-01&end_date=2025-10-26" | jq '.data | length'
```
Count observations for period analysis.

### Case 4: Multi-Location Comparison
```bash
# Sydney
curl "https://wbgt-mcp-server.workers.dev/api/historic_observations?start_date=2025-10-01&end_date=2025-10-26&latitude=-33.8018&longitude=151.1254"

# Melbourne
curl "https://wbgt-mcp-server.workers.dev/api/historic_observations?start_date=2025-10-01&end_date=2025-10-26&latitude=-37.8136&longitude=144.9631"
```

---

## Data Fields Reference

All endpoints return these core fields in data objects:

| Field | Type | Unit | Description |
|-------|------|------|-------------|
| `timestamp` | string | ISO 8601 | Observation/forecast time |
| `temperature` | number | °C | Air temperature |
| `humidity` | number | % | Relative humidity (0-100) |
| `dew_point` | number | °C | Dew point temperature |
| `wind_speed_ms` | number | m/s | Wind speed |
| `solar_radiation` | number | W/m² | Solar radiation intensity |
| `cloud_cover` | number | % | Cloud cover (0-100) |
| `uv_index` | number | - | UV index |
| `wbgt` | number | °C | Wet Bulb Globe Temperature (main metric) |
| `esi` | number | - | Environmental Stress Index |
| `apparent_temp` | number | °C | Apparent/felt temperature |

---

## Rate Limiting

Currently no rate limiting enforced. However, implement reasonable request intervals in production (1 request per 10 seconds recommended).

---

## Timezone Information

### Sydney (Default)
- **Timezone:** Australia/Sydney
- **UTC Offset:** UTC+10 (winter) / UTC+11 (summer with DST)
- **DST:** October-April

### Japan
- **Timezone:** Asia/Tokyo (JST)
- **UTC Offset:** UTC+9 (no DST)

---

## OpenAPI Specification

For automated client generation and detailed API documentation:
- **YAML:** `GET /api/docs/openapi.yaml`
- **JSON:** `GET /api/docs/openapi.json`

---

## Support & Documentation

- **Full API Documentation:** See [docs/HTTP_ENDPOINTS.md](docs/HTTP_ENDPOINTS.md)
- **Architecture Overview:** See [README.md](README.md)
- **Timezone Details:** See [docs/TIMEZONE_HANDLING_SUMMARY.md](docs/TIMEZONE_HANDLING_SUMMARY.md)
- **Technical Formulas:** See [src/WBGT.md](src/WBGT.md)

---

## Integration Checklist

- [ ] Test `/api/current` endpoint
- [ ] Handle error responses (400, 404, 500)
- [ ] Implement retry logic for `/api/historic_observations`
- [ ] Use `start_date` and `end_date` in YYYY-MM-DD format
- [ ] Cache forecast data (valid for ~6 hours)
- [ ] Monitor health endpoint for uptime (`/api/health`)
- [ ] Document timezone assumptions in your code
- [ ] Handle CORS properly in browser clients
- [ ] Use OpenAPI spec for client code generation

---

**Last Updated:** October 27, 2025
**API Version:** 1.0.0
**Status:** Production Ready
