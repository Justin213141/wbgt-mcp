# OpenMeteo Radiation Fields Standardization

## Executive Summary

Phase 1 extraction is aligned with WBGT.md technical requirements. The next refinement is to standardize all radiation field references to use OpenMeteo's `*_instant` variants for consistency and accuracy.

## Alignment with WBGT.md

### WBGT.md Specifications (Section 8: Complete Calculation Procedure)

**Line 228-237 - OpenMeteo Inputs:**
```
5. SRdown = Shortwave Solar Radiation GHI [W/m²]
6. Direct = Direct solar radiation [W/m²]
7. Diffuse = Diffuse solar radiation DHI [W/m²]
```

**Line 256-266 - Zero-Iteration Method:**
The Kong WBGT calculation uses these values DIRECTLY in:
- Shortwave radiation on globe (SRg)
- Shortwave radiation on wick (SRw)
- Direct beam fraction (fdir)

## The Problem with Non-Instant Variants

### Current Code Issue
- Some places use `shortwave_radiation` (hourly average)
- Some places use `shortwave_radiation_instant` (point-in-time)
- Mix of both causes data inconsistency

### Why This Matters for WBGT

From WBGT.md physics principles:
- WBGT calculations model instantaneous thermal balance
- Zero-iteration method requires snapshot measurements
- Hourly averages distort the calculation
- Example: Cloud passing during hour creates average different from instant at measurement time

### OpenMeteo API Reality
```
shortwave_radiation        = Hourly average (W/m²)
shortwave_radiation_instant = Instantaneous value at hour end (W/m²)
direct_radiation          = Hourly average
direct_radiation_instant  = Instantaneous value at hour end
diffuse_radiation         = Hourly average
diffuse_radiation_instant = Instantaneous value at hour end
```

## Standardization Plan (Phase 1.5)

### Fields to Standardize
1. `shortwave_radiation` → `shortwave_radiation_instant`
2. `direct_radiation` → `direct_radiation_instant`
3. `diffuse_radiation` → `diffuse_radiation_instant`

### Files Requiring Updates
- `src/types/weather-data.types.ts` - Type definitions
- `src/types/wbgt-calculation.types.ts` - Calculation types
- `src/index.ts` - Data extraction (lines using these fields)
- Any future parsers/service modules in Phase 2

### Verification Checklist
- [ ] All API query strings request `*_instant` fields
- [ ] Type definitions only include `*_instant` variants
- [ ] All data extraction code uses `*_instant` field names
- [ ] No remaining references to non-instant radiation fields
- [ ] Tests verify correct field extraction

## Timeline

- **Phase 1 Complete**: Calculation function extraction ✅
- **Phase 1.5** (proposed): Radiation field standardization
- **Phase 2**: Service module refactoring (incorporates standardization)

## Benefits

1. **Accuracy**: WBGT calculations use correct instantaneous values
2. **Consistency**: No ambiguity about which variant to use
3. **Documentation**: Clear that we need point-in-time measurements
4. **Prevention**: Blocks future bugs from mixing averaged vs instantaneous data
5. **Physics-Correct**: Aligns with Kong zero-iteration method assumptions

## Reference

- **WBGT.md**: Lines 228-237 (inputs), 256-291 (calculation procedure)
- **plan.md**: Section 1.5 (standardize OpenMeteo field references)
- **Kong Paper**: Zero-iteration WBGT requires instantaneous measurements
