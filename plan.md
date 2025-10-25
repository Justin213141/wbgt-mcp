# Kong WBGT Implementation Plan

## API Endpoint: `/api/WBGT`

### Data Source
OpenMeteo Historical Weather API: `https://open-meteo.com/en/docs/historical-weather-api`

---

## INPUTS (from OpenMeteo Hourly Data)

### Direct Measurements:
1. **`temperature_2m`** [°C] - Air temperature at 2 meters (Ta)
2. **`relative_humidity_2m`** [%] - Relative humidity (RH)
3. **`dew_point_2m`** [°C] - Dewpoint temperature (Tdew)
4. **`wet_bulb_temperature_2m`** [°C] - Psychrometric wet bulb (Tw)
5. **`surface_pressure`** [hPa] - Surface pressure (P) - convert to Pa by ×100
6. **`wind_speed_10m`** [m/s] - Wind speed at 10 meters (u10m)
7. **`shortwave_radiation_instant`** [W/m²] - Global Horizontal Irradiance (SRdown)
8. **`direct_radiation_instant`** [W/m²] - Direct solar radiation (Direct)
9. **`diffuse_radiation_instant`** [W/m²] - Diffuse solar radiation (Diffuse)
10. **`apparent_temperature`** [°C] - Apparent temperature (not used in Kong calc, but returned)
11. **`cloud_cover`** [%] - Cloud cover (not used in Kong calc, but available)

### Location/Time Parameters:
- **Latitude** (default: -33.8018 for Sydney)
- **Longitude** (default: 151.1254 for Sydney)
- **Timestamp** (ISO format, for solar angle calculations)

---

## OUTPUTS

### Primary Output:
1. **Kong WBGT** [°C] - Wet Bulb Globe Temperature using Kong et al. zero-iteration method
   - Formula: `ŴBGT = 0.7 × T̂nw + 0.2 × T̂g + 0.1 × Ta`

### Secondary Outputs (Intermediate Values):
2. **T̂g** [°C] - Black globe temperature (calculated)
3. **T̂nw** [°C] - Natural wet bulb temperature (calculated)
4. **Ta** [°C] - Air temperature (from input)
5. **Solar zenith angle (θ)** [degrees] - Calculated from location/time

### Additional Output:
6. **ESI (Environmental Stress Index)** - Heat stress metric
   - **Need to define calculation method**
   - Options:
     - Universal Thermal Climate Index (UTCI)
     - Heat Index
     - Humidex
     - Custom ESI formula

---

## CALCULATION FLOW

### Step 1: Solar Geometry
```
θ = calculateSolarZenithAngle(lat, lon, timestamp)
```

### Step 2: Atmospheric Parameters
```
ea = esat(Tdew)  // Vapor pressure
εa = 0.575 × ea^0.143  // Atmospheric emissivity
fdir = Direct / (Direct + Diffuse)  // Direct beam fraction
```

### Step 3: Radiation Components
```
SRup = 0.45 × SRdown
LRdown = εa × σ × Ta⁴
LRup = σ × Ta⁴
SRg = 0.5(1 - 0.05)[(1 - fdir)SRdown + fdir×SRdown/(2cos(θ)) + SRup]
LRg = 0.5 × 0.95 × (LRdown + LRup)
SRw = (1 - 0.4)[(1 + 0.007/4×0.0254)(1 - fdir)SRdown + (tan(θ)/π + 0.007/4×0.0254)fdir×SRdown + SRup]
LRw = 0.5 × 0.95 × (LRdown + LRup)
```

### Step 4: Air Properties (at Ta, P)
```
u2m = u10m × (2/10)^0.15
{ρ, μ, k, Pr, Sc, D} = calculateAirProperties(Ta, P)
```

### Step 5: Heat Transfer Coefficients
```
// Globe
Re_globe = ρ × u2m × 0.0508 / μ
Nu = 2.0 + 0.6 × Re_globe^0.5 × Pr^0.33
ĥcg = (k/0.0508) × Nu
ĥrg = 4 × σ × 0.95 × Ta³

// Wick
Re_wick = ρ × u2m × 0.007 / μ
ĥcw = (k/0.007) × 0.281 × Re_wick^0.6 × Pr^0.44
ĥrw = 4 × σ × 0.95 × Ta³
k̂x = (ρD/MD) × 0.281 × Re_wick^0.6 × Sc^0.44
β̂ = k̂x × 0.018015 × 2453000 / P
ĥew = β̂ × ∂esat/∂T|T=(Tw+Ta)/2
```

### Step 6: Temperature Calculations
```
T̂g = Ta + (SRg + LRg - σ×0.95×Ta⁴) / (ĥcg + ĥrg)
T̂nw = Ta + (SRw - β̂(esat(Ta) - ea) + LRw - σ×0.95×Ta⁴) / (ĥew + ĥcw + ĥrw)
```

### Step 7: Final WBGT
```
ŴBGT = 0.7 × T̂nw + 0.2 × T̂g + 0.1 × Ta
```

---

## API REQUEST EXAMPLE

```
GET /api/WBGT?start_date=2025-10-22&end_date=2025-10-23&latitude=-33.8018&longitude=151.1254
```

### Response Format:
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-10-22T00:00:00",
      "inputs": {
        "temperature_2m": 18.5,
        "relative_humidity_2m": 75,
        "dew_point_2m": 14.2,
        "wet_bulb_temperature_2m": 15.8,
        "surface_pressure": 1013.2,
        "wind_speed_10m": 3.5,
        "shortwave_radiation_instant": 450.0,
        "direct_radiation_instant": 300.0,
        "diffuse_radiation_instant": 150.0,
        "apparent_temperature": 17.2,
        "cloud_cover": 40
      },
      "outputs": {
        "kong_wbgt": 16.8,
        "black_globe_temp": 22.4,
        "natural_wet_bulb_temp": 16.2,
        "air_temp": 18.5,
        "solar_zenith_angle": 45.2,
        "esi": null
      }
    }
  ],
  "count": 24,
  "timestamp": "2025-10-24T12:00:00Z",
  "note": "Kong WBGT hourly data"
}
```

---

## IMPLEMENTATION TASKS

### 1. Add Missing Parameter
- ✅ Confirm `wind_speed_10m` is included in OpenMeteo request URL

### 2. Create Calculation Functions
- `calculateSolarZenithAngle(lat, lon, timestamp)` → θ [degrees]
- `calculateBuckSaturationVaporPressure(T)` → esat [Pa]
- `calculateVaporPressureDerivative(T)` → ∂esat/∂T
- `calculateAirProperties(Ta_K, P_Pa)` → {ρ, μ, k, Pr, Sc, D}
- `calculateWindAt2m(u10m, p=0.15)` → u2m
- `calculateRadiationComponents(Ta, SRdown, Direct, Diffuse, ea, θ)` → {SRg, LRg, SRw, LRw}
- `calculateHeatTransferCoefficients(Ta, Tw, P, u2m, airProps)` → {ĥcg, ĥrg, ĥcw, ĥrw, ĥew}
- `calculateKongBlackGlobe(Ta, SRg, LRg, ĥcg, ĥrg)` → T̂g
- `calculateKongNaturalWetBulb(Ta, Tw, SRw, LRw, ea, ĥcw, ĥrw, ĥew, β̂)` → T̂nw
- `calculateKongWBGT(Ta, T̂g, T̂nw)` → ŴBGT

### 3. Create HTTP Endpoint
- Route: `GET /api/WBGT`
- Query params: `start_date`, `end_date`, `latitude`, `longitude`
- Fetch from OpenMeteo Historical Weather API
- Process each hourly record through calculation chain
- Return JSON with inputs and outputs

### 4. Determine ESI Calculation
- **TODO**: Clarify which Environmental Stress Index to use
- Options: UTCI, Heat Index, Humidex, or custom formula

---

## CONSTANTS

```typescript
// Physical constants
const STEFAN_BOLTZMANN = 5.67e-8;  // W/(m²·K⁴)
const GAS_CONSTANT_AIR = 287.05;   // J/(kg·K)
const MOLECULAR_WEIGHT_WATER = 0.018015;  // kg/mol
const LATENT_HEAT = 2453000;  // J/kg

// Globe constants
const GLOBE_DIAMETER = 0.0508;  // m
const GLOBE_EMISSIVITY = 0.95;
const GLOBE_ALBEDO = 0.05;

// Wick constants
const WICK_DIAMETER = 0.007;  // m
const WICK_LENGTH = 0.0254;  // m
const WICK_EMISSIVITY = 0.95;
const WICK_ALBEDO = 0.4;

// Surface constants
const SURFACE_ALBEDO = 0.45;

// Dimensionless numbers
const PRANDTL = 0.71;
const SCHMIDT = 0.60;

// Cylinder correlation coefficients
const CYLINDER_B = 0.281;
const CYLINDER_C = 0.4;
const CYLINDER_A = 0.56;
```

---

## NOTES

- OpenMeteo provides `wet_bulb_temperature_2m` directly (uses Stull formula internally)
- All temperatures in Celsius for input/output, convert to Kelvin for calculations
- Pressure from OpenMeteo is in hPa, multiply by 100 to get Pa
- Solar zenith angle requires astronomical calculations (declination, hour angle)
- ESI calculation method needs to be defined before implementation
