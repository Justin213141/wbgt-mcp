ŴBGT = 0.7 × T̂nw + 0.2 × T̂g + 0.1 × Ta
```

---

## 1. Black Globe Temperature (T̂g)

### Zero-Iteration Formula (Equation 9 from Kong paper)
```
T̂g = Ta + (SRg + LRg - σϵgTa⁴) / (ĥcg + ĥrg)
```

**Where:**

### Radiative Heat Transfer Coefficient
```
ĥrg = 4σϵgTa³
```

### Convective Heat Transfer Coefficient  
```
ĥcg = (k/D) × Nu
Nu = 2.0 + 0.6 × Re^0.5 × Pr^0.33
Re = ρVD/μ
```
**All properties evaluated at Ta (not at Tg)** - this is the key simplification!

**Constants:**
- D = 0.0508 m (globe diameter)
- σ = 5.67×10⁻⁸ W/(m²·K⁴)
- εg = 0.95 (globe emissivity)
- αg = 0.05 (globe albedo)

### Shortwave Radiation to Globe (SRg)
```
SRg = 0.5(1 - αg)[(1 - fdir)SRdown + fdir×SRdown/(2cos(θ)) + SRup]
```

**Where:**
- SRdown = Shortwave Solar Radiation GHI from OpenMeteo
- SRup = αsfc × SRdown (where αsfc = 0.45)
- fdir = Direct/(Direct + Diffuse)
- θ = solar zenith angle

### Longwave Radiation to Globe (LRg)
```
LRg = 0.5 × εg × (LRdown + LRup)
```

**Approximation when LR not available:**
```
LRdown = εa × σ × Ta⁴
LRup = σ × Ta⁴
εa = 0.575 × ea^0.143

Therefore:
LRg = 0.5 × εg × σ × Ta⁴ × (1 + εa)
```

---

## 2. Natural Wet Bulb Temperature (T̂nw)

### Zero-Iteration Formula (Equation 11 from Kong paper)
```
T̂nw = Ta + (SRw - β̂(esat(Ta) - ea) + LRw - σϵwTa⁴) / (ĥew + ĥcw + ĥrw)
```

**Where:**

### Radiative Heat Transfer Coefficient
```
ĥrw = 4σϵwTa³
```

### Evaporative Heat Transfer Coefficient
```
ĥew = β̂ × ∂esat(T)/∂T |T=(Tw+Ta)/2

β̂ = k̂x × MH₂O × ΔH / P
```

**Where:**
- Tw = psychrometric wet bulb temperature (Stull formula - see below)
- MH₂O = 18.015 g/mol
- ΔH = 2,453,000 J/kg
- P = surface pressure (Pa)

### Convective Heat Transfer Coefficient (Cylinder)
```
ĥcw = (k/D) × b × Re^(1-c) × Pr^(1-a)

b = 0.281
c = 0.4  
a = 0.56
Re = ρVD/μ
```
**All properties evaluated at Ta or Tw (not at Tnw)**

### Convective Mass Transfer Coefficient
```
k̂x = (ρD/MD) × b × Re^(1-c) × Sc^(1-a)
```
**Where:**
- D = diffusivity of water vapor in air
- M = molecular weight of air

**Constants:**
- D = 0.007 m (wick diameter)
- L = 0.0254 m (wick length)
- εw = 0.95 (wick emissivity)
- αw = 0.4 (wick albedo)

### Shortwave Radiation to Wick (SRw)
```
SRw = (1 - αw)[(1 + D/4L)(1 - fdir)SRdown + (tan(θ)/π + D/4L)fdir×SRdown + SRup]
```

### Longwave Radiation to Wick (LRw)
```
LRw = 0.5 × εw × (LRdown + LRup)
```

**Approximation when LR not available:**
```
LRw = 0.5 × εw × σ × Ta⁴ × (1 + εa)
```

---

## 3. Psychrometric Wet Bulb Temperature (Tw)

**Stull (2011) empirical formula - used as initial guess:**
```
Tw = Ta × atan[0.151977(RH% + 8.313659)^0.5] 
     + atan(Ta + RH%) 
     - atan(RH% - 1.676331) 
     + 0.00391838(RH%)^1.5 × atan(0.023101 × RH%) 
     - 4.686035
```

**Where:**
- Ta in °C
- RH% = relative humidity as percentage (0-100)

**Alternative if you have dewpoint:**
Calculate RH first, then use Stull formula:
```
RH% = 100 × esat(Tdew) / esat(Ta)
```

---

## 4. Saturation Vapor Pressure

**Buck (1981) formula:**
```
esat(T) = 611.21 × exp[(18.678 - T/234.5) × (T/(257.14 + T))]
```
**Where:**
- T in °C
- esat in Pa

**Derivative for evaporative heat transfer:**
```
∂esat/∂T ≈ esat(T) × [18.678/(257.14 + T) - T/(234.5(257.14 + T))] × [257.14/(257.14 + T)]
```

Or numerically:
```
∂esat/∂T ≈ [esat(T + 0.1) - esat(T - 0.1)] / 0.2
```

---

## 5. Atmospheric Emissivity
```
εa = 0.575 × ea^0.143
```

**Where:**
```
ea = RH × esat(Ta)    [if using relative humidity]
ea = esat(Tdew)       [if using dewpoint]
```

---

## 6. Direct Beam Fraction

**Option 1: Calculate from measurements (BEST):**
```
fdir = Direct / (Direct + Diffuse)
```

**Option 2: Estimate from total solar radiation:**
```
fdir = exp(3 - 1.34×S* - 1.65/S*)   if θ ≤ 89.5°
fdir = 0                             if θ > 89.5°

S* = SRdown / Smax
Smax = 1367 × cos(θ) / d²
```

---

## 7. Wind Speed Conversion (10m to 2m)

**Power-law profile:**
```
u2m = u10m × (2/10)^p
```

**Stability class exponents (p):**

| Stability | Conditions | Urban p | Rural p |
|-----------|-----------|---------|---------|
| A, B, C   | Unstable (day, sunny) | 0.15-0.20 | 0.07-0.10 |
| D         | Neutral | 0.25 | 0.15 |
| E, F      | Stable (night) | 0.30 | 0.35-0.55 |

**For most running conditions, use p ≈ 0.15-0.25**

---

## 8. Complete Calculation Procedure

### Inputs from OpenMeteo API:
1. Ta = Air temperature (2m) [°C]
2. Tdew = Dewpoint temperature [°C] OR RH = Relative humidity [%]
3. u10m = Wind speed at 10m [m/s]
4. P = Surface pressure [Pa]
5. SRdown = Shortwave Solar Radiation GHI [W/m²]
6. Direct = Direct solar radiation [W/m²]
7. Diffuse = Diffuse solar radiation DHI [W/m²]
8. Date, time, latitude, longitude (for solar angles)

### Calculation Steps:

**Step 1: Derive basic parameters**
```
u2m = u10m × (2/10)^0.15  [or appropriate exponent]
θ = solar zenith angle (from astronomical formulas)
fdir = Direct / (Direct + Diffuse)
ea = esat(Tdew)  [or RH × esat(Ta)]
εa = 0.575 × ea^0.143
```

**Step 2: Estimate longwave radiation**
```
LRdown = εa × σ × Ta⁴
LRup = σ × Ta⁴
SRup = 0.45 × SRdown
```

**Step 3: Calculate T̂g**
```
SRg = 0.5(1 - 0.05)[(1 - fdir)SRdown + fdir×SRdown/(2cos(θ)) + SRup]
LRg = 0.5 × 0.95 × (LRdown + LRup)

Calculate ĥcg from u2m, Ta, P (Reynolds number, Nusselt number)
ĥrg = 4 × 5.67e-8 × 0.95 × Ta³

T̂g = Ta + (SRg + LRg - σ×0.95×Ta⁴) / (ĥcg + ĥrg)
```

**Step 4: Calculate psychrometric wet bulb (Tw)**
```
Use Stull formula with Ta and RH%
Note openmeteo api provides this as wet_bulb_temperature_2m
```

**Step 5: Calculate T̂nw**
```
SRw = (1 - 0.4)[(1 + 0.007/4×0.0254)(1 - fdir)SRdown 
      + (tan(θ)/π + 0.007/4×0.0254)fdir×SRdown + SRup]
LRw = 0.5 × 0.95 × (LRdown + LRup)

Calculate ĥcw from u2m, Ta (or Tw), P
Calculate k̂x from u2m, Ta (or Tw), P
β̂ = k̂x × 0.018015 × 2453000 / P
ĥew = β̂ × ∂esat/∂T at T=(Tw+Ta)/2
ĥrw = 4 × 5.67e-8 × 0.95 × Ta³

T̂nw = Ta + (SRw - β̂(esat(Ta) - ea) + LRw - σ×0.95×Ta⁴) / (ĥew + ĥcw + ĥrw)
```

**Step 6: Calculate ŴBGT**
```
ŴBGT = 0.7 × T̂nw + 0.2 × T̂g + 0.1 × Ta
```

---

## 9. Key Advantages of Zero-Iteration Method

1. **No iteration required** - direct calculation
2. **Same accuracy** as Liljegren (within 1°C for 99% of cases)
3. **Same inputs** as Liljegren method
4. **Computationally efficient** - suitable for real-time calculation
5. **Works with approximated longwave radiation** (just like Liljegren)

---

## 10. Air Properties Functions

**For completeness, you'll need these at temperature T and pressure P:**

### Density of air (ρ)
```
ρ = P / (R × T)
R = 287.05 J/(kg·K) for dry air
T in Kelvin = Ta + 273.15
```

### Dynamic viscosity (μ)  
```
μ = 1.458e-6 × T^1.5 / (T + 110.4)
T in Kelvin
μ in Pa·s
```

### Thermal conductivity (k)
```
k = 0.02624 × (T/300)^0.8646
T in Kelvin
k in W/(m·K)
```

### Prandtl number
```
Pr ≈ 0.71 (approximately constant for air)
```

### Schmidt number
```
Sc ≈ 0.60 (for water vapor in air)
```

### Diffusivity of water vapor in air (D)
```
D = 2.42e-5 × (T/300)^1.75 × (101325/P)
T in Kelvin, P in Pa
D in m²/s