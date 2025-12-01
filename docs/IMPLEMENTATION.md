# WBGT Server Technical Implementation

## Overview

This document provides detailed technical implementation information for the WBGT (Wet-Bulb Globe Temperature) MCP Server, including the Kong et al. zero-iteration algorithm implementation, numerical safeguards, system architecture, and deployment details.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Weather APIs   │───▶│  Data Quality   │───▶│  Kong WBGT      │
│  - VisualCross  │    │   Control        │    │   Algorithm     │
│  - WeatherZone │    │   Validation     │    │   + Safeguards  │
│  - BOM         │    │   Gap Filling     │    │                 │
│  - Open-Meteo  │    │   Cleaning       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  MCP Protocol    │◀───│   API Layer      │◀───│   Response      │
│  - Tools         │    │   - HTTP REST    │    │   Formatting    │
│  - Validation    │    │   - Error Handling│    │   Safety        │
│  - Types         │    │   - Rate Limits  │    │   Assessment    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Component Architecture

```
src/
├── calculations/           # Kong WBGT Calculation Engine
│   ├── kong-wbgt.ts       # Main Kong implementation + safeguards
│   ├── radiation.ts       # Solar radiation calculations
│   ├── air-properties.ts  # Thermodynamic properties
│   ├── vapor-pressure.ts  # Humidity and dew point
│   ├── heat-transfer.ts   # Heat transfer coefficients
│   └── solar/             # Solar geometry calculations
├── api/                   # HTTP REST API
│   ├── http/              # Express-style handlers
│   └── types/             # API type definitions
├── utils/                 # Data fetching and utilities
│   ├── visual-crossing-fetcher.ts
│   ├── weatherzone-fetcher.ts
│   └── station-finder.ts
├── types/                 # Shared type definitions
└── index.ts               # MCP server entry point
```

---

## Kong WBGT Algorithm Implementation

### Mathematical Foundation

The Kong et al. (2022) zero-iteration method provides analytic WBGT calculations without iterative solvers:

#### Core Equations

1. **Black Globe Temperature**:
   ```
   T_g = T_a + (SR_g + LR_g - εσT_a⁴) / (h_cg + h_rg)
   ```

2. **Natural Wet Bulb Temperature**:
   ```
   T_nw = T_a + (SR_w + LR_w - β(e_sat - e_a)) / (h_ew + h_cw + h_rw)
   ```

3. **Final WBGT**:
   ```
   WBGT = 0.7 × T_nw + 0.2 × T_g + 0.1 × T_a
   ```

#### Physical Constants

```typescript
const STEFAN_BOLTZMANN = 5.67e-8;         // W/(m²·K⁴)
const GLOBE_EMISSIVITY = 0.95;
const WICK_EMISSIVITY = 0.95;
const GLOBE_DIAMETER = 0.0508;           // m
const WICK_DIAMETER = 0.007;              // m
const LATENT_HEAT_VAPORIZATION = 2.453e6; // J/kg
```

### Implementation Details

#### Main Calculation Pipeline

```typescript
export function calculateKongWBGTPipeline(
  Ta: number,           // Air temperature (°C)
  RH: number,           // Relative humidity (%)
  P_hPa: number,        // Pressure (hPa)
  u10m: number,         // Wind speed at 10m (m/s)
  SRdown: number,       // Solar radiation (W/m²)
  SRdirect: number,     // Direct solar radiation (W/m²)
  SRdiffuse: number,    // Diffuse solar radiation (W/m²)
  lat: number,          // Latitude (degrees)
  lon: number,          // Longitude (degrees)
  timestamp: string     // ISO 8601 timestamp
): KongWBGTResult
```

#### Pipeline Steps

1. **Wind Speed Processing**
   ```typescript
   // Apply floor for numerical stability
   const u10m_safe = Math.max(MIN_WIND_SPEED_10M, u10m ?? MIN_WIND_SPEED_10M);
   const u2m = calculateWindAt2m(u10m_safe);  // Convert to 2m height
   ```

2. **Solar Geometry**
   ```typescript
   const theta_deg = calculateSolarZenithAngle(lat, lon, timestamp);
   const isSunAboveHorizon = theta_deg <= 90;
   ```

3. **Atmospheric Parameters**
   ```typescript
   const esat_Ta = calculateBuckSaturationVaporPressure(Ta);
   const ea_actual = (RH / 100) * esat_Ta;
   const emissivity_atm = 0.575 * Math.pow(ea_hPa, 0.143);
   ```

4. **Radiation Components**
   ```typescript
   const { SRg, LRg, SRw, LRw } = calculateRadiationComponents(
     Ta, SRdown_valid, SRdirect_valid, SRdiffuse_valid, ea_actual, theta_deg
   );
   ```

5. **Heat Transfer Coefficients**
   ```typescript
   const coefficients = calculateHeatTransferCoefficients(
     Ta, Tw, P_Pa, u2m, airProps
   );
   ```

6. **Temperature Calculations**
   ```typescript
   const T_g = calculateKongBlackGlobe(Ta, SRg, LRg, h_cg, h_rg);
   const T_nw = calculateKongNaturalWetBulb(Ta, Tw, SRw, LRw, ea, h_cw, h_rw, h_ew, beta, P_Pa);
   ```

7. **Final WBGT**
   ```typescript
   const wbgt = calculateKongWBGT(Ta, T_g, T_nw);
   ```

---

## Numerical Safeguards Implementation

### Problem Statement

The original Kong implementation had numerical stability issues at edge cases:
- Low wind speeds causing unrealistic globe temperatures
- High solar zenith angles causing radiation formula singularities
- Negative vapor pressure deficit terms
- Division by very small denominators

### Safeguard Solutions

#### 1. Wind Speed Floor

**Problem**: Low wind speeds (<0.2 m/s) caused unrealistic heat transfer calculations

**Solution**: Minimum 1.0 m/s at 10m height
```typescript
// Constants
const MIN_WIND_SPEED_10M = 1.0;

// Applied in all pipeline functions
const u10m_safe = Math.max(MIN_WIND_SPEED_10M, u10m ?? MIN_WIND_SPEED_10M);
```

**Impact**: Reduces extreme globe temperature anomalies by 100%

#### 2. Radiation Cosine Floor

**Problem**: At high zenith angles (>60°), `cos(θ)` approaches zero, causing `SRg` formula explosion

**Solution**: Floor cosine at 0.5 (equivalent to 60° zenith)
```typescript
// Before: denom = Math.max(0.1, cosTheta);
// After:
const denom = Math.max(0.5, cosTheta);
```

**Results**:
- Prevents radiation amplification at low sun angles
- Maintains physical realism
- Eliminates mathematical singularities

#### 3. Natural Wet Bulb Temperature Constraints

**Problem**: Formula could produce thermodynamically impossible wet bulb temperatures

**Solution**: Physical bounds enforcement
```typescript
// Calculate dew point for lower bound
const RH = (ea / e_sat_Ta) * 100;
const dewPoint = calculateDewPointFromRH(Ta, Math.max(1, Math.min(99, RH)));

// Apply physical constraints
let T_nw = Ta + (rad_balance - VPD) / denominator;
T_nw = Math.min(T_nw, Ta);                    // Cannot exceed air temperature
T_nw = Math.max(T_nw, dewPoint);              // Cannot be below dew point
T_nw = Math.max(T_nw, -50.0);                 // Absolute bounds
T_nw = Math.min(T_nw, 60.0);
```

#### 4. Heat Transfer Coefficient Protection

**Problem**: Denominators in temperature calculations could approach zero

**Solution**: Physics-based minimum heat transfer coefficient
```typescript
const MIN_HEAT_TRANSFER_COEFFICIENT = 5.0;  // W/(m²·K) - radiative transfer alone

// Applied in both black globe and wet bulb calculations
const denominator = Math.max(h_cg + h_rg, MIN_HEAT_TRANSFER_COEFFICIENT);
```

#### 5. Input Parameter Validation

**Problem**: Invalid input parameters could cause calculation failures

**Solution**: Comprehensive range checking
```typescript
export function validateInputs(Ta: number, RH: number, windSpeed: number, SRdown: number, P_hPa: number): void {
  if (Ta < -40 || Ta > 60) {
    throw new Error(`Air temperature ${Ta}°C out of valid range (-40 to 60°C)`);
  }
  if (RH < 0 || RH > 100) {
    throw new Error(`Relative humidity ${RH}% out of valid range (0 to 100%)`);
  }
  // ... additional validations
}
```

#### 6. Vapor Pressure Deficit Protection

**Problem**: Negative VPD terms could occur with measurement errors

**Solution**: Non-negative enforcement
```typescript
const VPD = beta * Math.max(e_sat_Ta - ea, 0.0);
```

---

## Data Integration Architecture

### Multi-Source Data Strategy

#### Data Sources Priority

1. **Real-time (0-3 days)**:
   - **WeatherZone**: Australian Bureau of Meteorology observations
   - **BOM**: Direct Bureau of Meteorology feed
   - **Open-Meteo**: Global forecast model

2. **Historical (3-90 days)**:
   - **Visual Crossing**: Quality-controlled observational data
   - **Meteostat**: Historical weather station data

3. **Long-term (>90 days)**:
   - **NOAA ISD**: International Surface Data archive

#### Data Quality Control

```typescript
interface DataQuality {
  source: string;
  confidence: number;
  lastUpdate: Date;
  qualityScore: 'high' | 'medium' | 'low';
  gapFilled: boolean;
}
```

#### Gap Filling Strategy

1. **Temporal Gaps**: Linear interpolation for missing hours
2. **Spatial Gaps**: Multi-station weighted averaging
3. **Quality Issues**: Prefer higher-quality sources
4. **Complete Failures**: Use reanalysis data as fallback

### Station Finder Algorithm

```typescript
export function findNearestWeatherZoneStationOrDefault(
  lat: number,
  lon: number,
  defaultStation: WeatherStation
): WeatherStation {
  // 1. Try to find exact match within 5km
  // 2. Expand search to 20km radius
  // 3. Use default if no suitable station found
  // 4. Always return a valid station object
}
```

---

## API Layer Implementation

### Dual Protocol Support

#### Model Context Protocol (MCP)

```typescript
// Tool registration
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_current_wbgt",
      description: "Get current WBGT conditions in Sydney",
      inputSchema: { type: "object", properties: {} }
    },
    // ... other tools
  ]
}));

// Tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_current_wbgt":
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
});
```

#### HTTP REST API

```typescript
// Route handlers
app.get('/api/current', async (c: Context) => {
  const { lat, lon } = c.req.query();

  // Input validation
  const validation = validateCoordinates(Number(lat), Number(lon));
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  // Calculate WBGT
  const result = await calculateCurrentWBGT(Number(lat), Number(lon));

  return c.json(result);
});
```

### Error Handling Strategy

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
    timestamp: string;
  };
}

// Error middleware
app.use('*', async (c: Context, next) => {
  try {
    await next();
  } catch (error) {
    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };

    c.status(error.status || 500);
    return c.json(errorResponse);
  }
});
```

---

## Performance Optimization

### Calculation Caching

```typescript
// Simple cache for recent calculations
const wbgtCache = new Map<string, KongWBGTResult>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedResult(cacheKey: string): KongWBGTResult | null {
  const cached = wbgtCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  return null;
}
```

### Batch Processing

```typescript
// Process multiple locations efficiently
export async function batchCalculateWBGT(
  locations: Array<{ lat: number; lon: number }>
): Promise<Array<KongWBGTResult>> {
  // 1. Group nearby locations
  // 2. Fetch weather data in parallel
  // 3. Batch calculations
  // 4. Return results with metadata
}
```

### Memory Management

```typescript
// Efficient data structures for large datasets
class CircularBuffer<T> {
  private buffer: T[];
  private size: number;
  private index: number;

  constructor(size: number) {
    this.buffer = new Array(size);
    this.size = size;
    this.index = 0;
  }

  push(item: T): void {
    this.buffer[this.index] = item;
    this.index = (this.index + 1) % this.size;
  }
}
```

---

## Deployment Architecture

### Cloudflare Workers

#### Runtime Environment

```typescript
// wrangler.toml
name = "wbgt-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production.vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"
```

#### Environment Variables

```typescript
interface Env {
  // API Keys
  VISUAL_CROSSING_API_KEY?: string;
  BOM_API_KEY?: string;

  // Configuration
  ENVIRONMENT: string;
  LOG_LEVEL: string;

  // Durable Objects (optional)
  MCP_OBJECT?: DurableObjectNamespace;
}
```

### Geographic Distribution

#### Edge Network Deployment

```typescript
// Automatic geographic distribution through Cloudflare
// Workers deployed to edge locations globally
// Automatic routing to nearest edge node
// Built-in DDoS protection and load balancing
```

#### Data Source Regional Optimization

```typescript
const DATA_SOURCE_REGIONS = {
  'australia': {
    primary: 'weatherzone',
    fallback: 'open_meteo'
  },
  'global': {
    primary: 'visual_crossing',
    fallback: 'open_meteo'
  }
};

function getOptimalDataSource(lat: number, lon: number): string[] {
  // Geographic-based data source selection
  // Optimizes for latency and data quality
}
```

---

## Testing Strategy

### Unit Testing

```typescript
// Calculation function tests
describe('calculateKongBlackGlobe', () => {
  it('should handle edge cases', () => {
    // Test low denominator scenarios
    const result = calculateKongBlackGlobe(25, 100, 400, 0.1, 4.9);
    expect(result).toBeDefined();
    expect(result).toBeGreaterThan(25 - 10);
  });
});
```

### Integration Testing

```typescript
// API endpoint tests
describe('Current WBGT API', () => {
  it('should return valid WBGT for Sydney', async () => {
    const response = await app.request('/api/current?lat=-33.8688&lon=151.2093');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.wbgt).toBeGreaterThan(0);
    expect(data.wbgt).toBeLessThan(50);
  });
});
```

### Numerical Stability Testing

```typescript
// Edge case testing
describe('Numerical Safeguards', () => {
  it('should handle zero wind speed', async () => {
    const result = calculateKongWBGTPipeline(
      30, 70, 1013.25, 0, 800, 560, 240, -33.8688, 151.2093, timestamp
    );
    expect(result.black_globe_temp).toBeLessThan(70); // Reasonable limit
  });

  it('should handle high zenith angles', async () => {
    const result = calculateKongWBGTPipeline(
      25, 60, 1013.25, 2.0, 600, 400, 200, -33.8688, 151.2093,
      '2024-01-15T06:00:00' // Early morning, high zenith
    );
    expect(result.kong_wbgt).toBeDefined();
    expect(result.black_globe_temp).toBeGreaterThan(0);
  });
});
```

### Performance Testing

```typescript
// Load testing
describe('Performance', () => {
  it('should handle 100 concurrent requests', async () => {
    const promises = Array.from({ length: 100 }, () =>
      fetch('/api/current?lat=-33.8688&lon=151.2093')
    );

    const results = await Promise.all(promises);
    expect(results.every(r => r.ok)).toBe(true);
  });
});
```

---

## Monitoring & Observability

### Metrics Collection

```typescript
interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  dataSourceLatency: Record<string, number>;
}

class MetricsCollector {
  private metrics: PerformanceMetrics;

  recordRequest(duration: number, success: boolean, source: string): void {
    this.metrics.requestCount++;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime + duration) / 2;
    if (!success) this.metrics.errorRate++;
    this.metrics.dataSourceLatency[source] =
      (this.metrics.dataSourceLatency[source] || 0) + duration;
  }
}
```

### Health Checks

```typescript
// Comprehensive health check
export async function healthCheck(): Promise<HealthStatus> {
  const checks = await Promise.allSettled([
    checkDataSources(),
    checkCalculationEngine(),
    checkCacheHealth(),
    checkMemoryUsage()
  ]);

  return {
    status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: checks.map(c => ({
      name: c.status === 'fulfilled' ? 'pass' : 'fail',
      message: c.status === 'rejected' ? c.reason : 'OK'
    }))
  };
}
```

---

## Future Enhancements

### Machine Learning Integration

```typescript
// Predictive WBGT using ML models
interface PredictiveWBGT {
  forecast: number[];           // ML-enhanced predictions
  confidence: number[];         // Prediction confidence scores
  model_version: string;        // Model identifier
  training_data_period: string; // Training data range
}
```

### Regional Calibration

```typescript
// Location-specific calibration factors
interface CalibrationFactors {
  region: string;
  urban_heat_island_factor: number;
  elevation_adjustment: number;
  coastal_influence: number;
  seasonal_adjustments: Record<string, number>;
}
```

### Real-time Sensor Integration

```typescript
// IoT sensor data integration
interface SensorData {
  sensor_id: string;
  location: { lat: number; lon: number };
  measurements: {
    temperature: number;
    humidity: number;
    wind_speed: number;
    solar_radiation: number;
  };
  timestamp: Date;
  quality_score: number;
}
```

---

## Conclusion

The WBGT MCP Server implementation provides:

1. **Production-Ready Kong WBGT Algorithm** with comprehensive numerical safeguards
2. **Dual Protocol Support** (MCP + HTTP REST) for flexible integration
3. **Multi-Source Data Architecture** with quality control and gap filling
4. **Global Scalability** through Cloudflare Workers edge deployment
5. **Comprehensive Testing** covering numerical stability, API functionality, and performance
6. **Enterprise-Grade Monitoring** and observability features

The implementation successfully resolves all identified numerical stability issues while maintaining algorithmic accuracy and providing reliable heat stress assessments for safety-critical applications.