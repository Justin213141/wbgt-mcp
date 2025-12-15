# Solar Zenith Angle Calculation Fix

**Date**: December 8, 2025
**File**: `weather/kong_wbgt.py`
**Impact**: Improved WBGT calculation accuracy for all activities

## Problem

The solar zenith angle calculation in the Kong WBGT framework had a **5.63° error** for Sydney at 1:00 PM on December 8, 2025 (AEDT).

### Test Case
- **Location**: Sydney (-33.8688°, 151.2093°)
- **Time**: December 8, 2025 at 1:00 PM (AEDT, UTC+11)
- **Expected**: 11.50° (NOAA reference)
- **Actual (before fix)**: 17.13° (+5.63° error)

## Root Cause Analysis

Three issues were identified in `calculate_solar_zenith_angle()`:

### 1. No Longitude Correction
- Hour angle used clock time directly
- No adjustment for longitude offset from timezone reference meridian
- For Sydney at 151.2°E with AEST reference at 150°E: ~5 minutes offset ignored

### 2. No DST Handling
- During AEDT (UTC+11), clocks are 1 hour ahead of AEST (UTC+10)
- Using clock hour 13:00 directly created ~15° hour angle error
- December is Australian summer = DST active

### 3. No Equation of Time
- Earth's orbit is elliptical, not circular
- Solar noon varies by ±16 minutes throughout the year
- December 8 has EoT of ~+8 minutes → ~2° correction needed

## Solution

Replaced the simplified formula with a corrected implementation that includes:

### True Solar Time Calculation
```python
true_solar_time = clock_time + longitude_correction + equation_of_time - timezone_offset
```

Where:
- `longitude_correction` = 4 minutes per degree of longitude
- `equation_of_time` = Spencer's formula for orbital eccentricity
- `timezone_offset` = actual UTC offset (including DST)

### Spencer's Formula for Declination
More accurate than simple `23.45 * sin(...)` approximation:
```python
B = 2π × (day_of_year - 1) / 365
declination = 0.006918 - 0.399912×cos(B) + 0.070257×sin(B)
            - 0.006758×cos(2B) + 0.000907×sin(2B)
            - 0.002697×cos(3B) + 0.00148×sin(3B)
```

### Spencer's Formula for Equation of Time
```python
B = 2π × (day_of_year - 1) / 365
EoT = 229.18 × (0.000075 + 0.001868×cos(B) - 0.032077×sin(B)
              - 0.014615×cos(2B) - 0.040849×sin(2B))  # in minutes
```

## Results

| Time | NOAA Reference | Before Fix | After Fix | Improvement |
|------|----------------|------------|-----------|-------------|
| Dec 8, 1:00 PM AEDT | 11.50° | 17.13° | 11.58° | 5.55° |
| Dec 8, 6:00 AM AEDT | 86.59° | ~92° | 86.69° | ~5° |
| Dec 8, 12:00 PM AEDT | 15.18° | ~20° | 15.28° | ~5° |
| Jun 8, 12:00 PM AEST | 56.74° | ~60° | 56.67° | ~3° |

**Error reduction**: 5.63° → 0.08° (99% improvement)

## Files Changed

1. **`weather/kong_wbgt.py`**
   - Added `calculate_equation_of_time()` function using Spencer's formula
   - Updated `calculate_solar_zenith_angle()` with proper solar time calculation
   - Updated `calculate_solar_zenith_angle_by_timezone()` to pass actual UTC offset
   - Updated `calculate_solar_zenith_angle_enhanced()` to accept UTC offset
   - Updated `calculate_radiation_components()` to accept UTC offset
   - Updated `calculate_kong_wbgt_pipeline()` to determine and pass actual UTC offset

2. **`weather/debug_solar_zenith.py`** (added)
   - Diagnostic script comparing implementations

3. **`weather/test_solar_zenith_fix.py`** (added)
   - Verification test suite

## Verification

Run the test suite:
```bash
cd weather
python test_solar_zenith_fix.py
```

Expected output:
```
✓ ALL TESTS PASS: Solar zenith fix verified
```

## Technical Notes

### Why Not Use the Simplified Formula?

The user's proposed simplified formula:
```javascript
const longitudeCorrection = (longitude - 150) / 15;
const localSolarTime = date.getHours() + longitudeCorrection;
```

This doesn't work because:
1. Uses 150°E as AEST reference, but during DST the effective reference is 165°E
2. No equation of time correction
3. Results in 6.46° error (worse than the original!)

### NOAA Algorithm Reference

The corrected implementation follows the NOAA Solar Calculator algorithm:
- https://gml.noaa.gov/grad/solcalc/calcdetails.html

### DST Handling

The implementation uses `pytz.timezone('Australia/Sydney')` to automatically detect DST:
- October-April: AEDT (UTC+11)
- April-October: AEST (UTC+10)

## Impact on WBGT

Solar zenith angle directly affects:
- Direct radiation component calculation
- Globe temperature estimation
- Natural wet bulb temperature

A 5° error in solar zenith can result in 0.5-1°C error in WBGT, which is significant for heat stress assessment.
