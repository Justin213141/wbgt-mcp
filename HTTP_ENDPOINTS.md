# WBGT Sydney Runner API - HTTP Endpoints Guide

## Overview
Your Cloudflare Workers MCP server now exposes both **MCP protocol endpoints** and **direct HTTP API endpoints**. The HTTP endpoints allow you to call the WBGT calculations without needing an MCP client.

---

## HTTP Endpoints

### 1. **GET /api/current**
Get current WBGT conditions in Sydney.

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-10-18T14:30:00Z",
    "temperature": 22.5,
    "humidity": 65,
    "dew_point": 14.2,
    "wind_speed_kmh": 12.3,
    "solar_radiation": 450,
    "wbgt": 19.8,
    "apparent_temp": 21.3
  },
  "timestamp": "2025-10-18T18:45:00.000Z",
  "note": "Current WBGT conditions in Sydney"
}
```

---

### 2. **GET /api/forecast**
Get 72-hour WBGT forecast with air quality data.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "localTimestamp": "2025-10-18 15:00:00",
      "temperature": 23.0,
      "humidity": 62,
      "dew_point": 14.5,
      "wind_speed_kmh": 10.0,
      "solar_radiation": 500,
      "cloud_cover": 30,
      "uv_index": 7.5,
      "wbgt": 20.2,
      "apparent_temp": 22.1,
      "rain_chance": 15,
      "air_quality": {
        "aqi": 45,
        "pm2_5": 12.5,
        "pm10": 25.0
      }
    }
    // ... more hourly forecasts
  ],
  "count": 72,
  "timestamp": "2025-10-18T18:45:00.000Z",
  "note": "WBGT forecast (72 hours)"
}
```

---

### 3. **GET /api/observations**
Get historical and recent WBGT observations. Query parameters determine the date range.

#### 3a. **Recent 24 hours** (no parameters)
```bash
GET /api/observations
```

#### 3b. **Date range (historical)**
```bash
GET /api/observations?start_date=2025-10-15&end_date=2025-10-18
```

Parameters:
- `start_date`: YYYY-MM-DD format
- `end_date`: YYYY-MM-DD format (optional, defaults to current date)

Response: Array of hourly observations for the date range.

#### 3c. **Activity window (max values during workout)**
```bash
GET /api/observations?start_time=2025-10-18T06:00:00Z&end_time=2025-10-18T07:00:00Z
```

Parameters:
- `start_time`: ISO 8601 datetime
- `end_time`: ISO 8601 datetime

Returns: **Single object** with maximum WBGT/temperature/humidity during the activity window.

**Response (activity window):**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-10-18T06:00:00Z to 2025-10-18T07:00:00Z",
      "temperature": 18.5,
      "humidity": 75,
      "dew_point": 13.8,
      "wind_speed_ms": 3.2,
      "solar_radiation": 80,
      "wbgt": 16.9,
      "apparent_temp": 17.2
    }
  ],
  "count": 1,
  "timestamp": "2025-10-18T18:45:00.000Z",
  "note": "Max WBGT conditions during activity from 2025-10-18T06:00:00Z to 2025-10-18T07:00:00Z"
}
```

---

### 4. **GET /health**
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "WBGT Sydney Runner API",
  "timestamp": "2025-10-18T18:45:00.000Z"
}
```

---

### 5. **GET /api**
List all available endpoints and examples.

---

## CORS Support
All HTTP endpoints have CORS headers enabled:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`

Browser clients can make requests directly to these endpoints.

---

## MCP Endpoints (Unchanged)
The original MCP protocol endpoints still work:

- **POST /sse** or **POST /sse/message**: SSE-based MCP server
- **POST /mcp**: Standard MCP server endpoint

---

## Usage Examples

### JavaScript/Fetch
```javascript
// Current conditions
const current = await fetch('https://your-worker.dev/api/current')
  .then(r => r.json());

// Forecast
const forecast = await fetch('https://your-worker.dev/api/forecast')
  .then(r => r.json());

// Activity window
const activity = await fetch('https://your-worker.dev/api/observations?start_time=2025-10-18T06:00:00Z&end_time=2025-10-18T07:00:00Z')
  .then(r => r.json());
```

### Python
```python
import requests

# Current conditions
current = requests.get('https://your-worker.dev/api/current').json()

# Historical data (date range)
hist = requests.get('https://your-worker.dev/api/observations', params={
    'start_date': '2025-10-15',
    'end_date': '2025-10-18'
}).json()
```

### cURL
```bash
# Current conditions
curl https://your-worker.dev/api/current

# 72-hour forecast
curl https://your-worker.dev/api/forecast

# Activity window (note: URL encoding required)
curl "https://your-worker.dev/api/observations?start_time=2025-10-18T06:00:00Z&end_time=2025-10-18T07:00:00Z"

# Health check
curl https://your-worker.dev/health
```

---

## Integration with Intervals.icu

Since you use **Intervals.icu** for analytics, you could:

1. **Post-activity enrichment**: After a run, call `/api/observations` with your activity start/end times to get max WBGT
2. **Enrichment automation**: Use a Cloudflare Cron Trigger to periodically fetch forecast and sync to custom fields
3. **Real-time dashboard**: Query `/api/current` and `/api/forecast` for decision-making before runs

---

## Error Responses

All endpoints return error responses in this format:

```json
{
  "success": false,
  "error": "Description of error",
  "timestamp": "2025-10-18T18:45:00.000Z"
}
```

Common status codes:
- `200`: Success
- `404`: Endpoint not found
- `500`: Server error (check logs)

---

## Implementation Notes

### What Changed
1. Added `handleHTTPRequest()` function that routes non-MCP requests to appropriate handlers
2. Each endpoint validates query parameters and delegates to existing calculation functions
3. CORS headers allow browser-based requests
4. Error handling wraps all operations in try-catch

### Data Sources
- **Current/Recent**: BOM (Bureau of Meteorology) + Open-Meteo solar radiation
- **Forecast**: BOM hourly forecasts + Open-Meteo solar/air quality
- **Historical**: Open-Meteo archive API (for dates >3 days old)

### Caching
- Forecast data cached for 12 hours (Cloudflare Cache API)
- Recent observations fetched fresh each request
- Historical data fetched on-demand

---

## Testing

Test the endpoints directly in your browser or terminal:

```bash
# Check it's working
curl https://your-worker.dev/api/current | jq .

# List all endpoints
curl https://your-worker.dev/api | jq .
```

If you're on Intervals.icu with a running session, get the exact timestamps and test:

```bash
curl "https://your-worker.dev/api/observations?start_time=2025-10-18T06:30:00Z&end_time=2025-10-18T07:15:00Z" | jq .
```

---

## Questions?

- **MCP protocol**: Still works unchanged at `/sse` and `/mcp`
- **Data freshness**: Forecast updates on cache expiry (12h); observations fresh per request
- **Rate limits**: Subject to Cloudflare Workers limits (check your plan)
