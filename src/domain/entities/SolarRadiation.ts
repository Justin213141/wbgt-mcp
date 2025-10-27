/**
 * Solar Radiation Value Object
 *
 * Represents solar radiation intensity with unit conversion and validation.
 * Immutable value object supporting W/m², cal/cm²/min, and lux units.
 */

/**
 * Solar radiation units supported
 */
export enum SolarRadiationUnit {
  WATTS_PER_SQUARE_METER = 'W/m²',
  CALORIES_PER_SQUARE_CM_MIN = 'cal/cm²/min',
  LUX = 'lux',
}

/**
 * Solar radiation value object with unit conversion
 */
export class SolarRadiation {
  private readonly _wattsPerSquareMeter: number;

  constructor(wattsPerSquareMeter: number) {
    if (!isFinite(wattsPerSquareMeter)) {
      throw new Error(`Solar radiation must be a finite number, got: ${wattsPerSquareMeter}`);
    }
    if (wattsPerSquareMeter < 0) {
      throw new Error(`Solar radiation cannot be negative, got: ${wattsPerSquareMeter}`);
    }
    this._wattsPerSquareMeter = wattsPerSquareMeter;
  }

  /**
   * Get solar radiation in watts per square meter (W/m²)
   */
  get wattsPerSquareMeter(): number {
    return this._wattsPerSquareMeter;
  }

  /**
   * Get solar radiation in calories per square centimeter per minute (cal/cm²/min)
   * 1 W/m² = 0.0143 cal/cm²/min
   */
  get caloriesPerSquareCmPerMin(): number {
    return this._wattsPerSquareMeter * 0.0143;
  }

  /**
   * Get solar radiation in lux (approximate)
   * 1 W/m² ≈ 120 lux for typical solar spectrum
   */
  get lux(): number {
    return this._wattsPerSquareMeter * 120;
  }

  /**
   * Create SolarRadiation from watts per square meter
   * @param wsm Solar radiation in W/m²
   * @returns SolarRadiation instance
   */
  static fromWattsPerSquareMeter(wsm: number): SolarRadiation {
    return new SolarRadiation(wsm);
  }

  /**
   * Create SolarRadiation from calories per square centimeter per minute
   * @param calCmMin Solar radiation in cal/cm²/min
   * @returns SolarRadiation instance
   */
  static fromCaloriesPerSquareCmPerMin(calCmMin: number): SolarRadiation {
    return new SolarRadiation(calCmMin / 0.0143);
  }

  /**
   * Create SolarRadiation from lux
   * @param lux Solar radiation in lux
   * @returns SolarRadiation instance
   */
  static fromLux(lux: number): SolarRadiation {
    return new SolarRadiation(lux / 120);
  }

  /**
   * Create SolarRadiation from value and unit
   * @param value Solar radiation value
   * @param unit Solar radiation unit
   * @returns SolarRadiation instance
   */
  static fromValue(value: number, unit: SolarRadiationUnit): SolarRadiation {
    switch (unit) {
      case SolarRadiationUnit.WATTS_PER_SQUARE_METER:
        return SolarRadiation.fromWattsPerSquareMeter(value);
      case SolarRadiationUnit.CALORIES_PER_SQUARE_CM_MIN:
        return SolarRadiation.fromCaloriesPerSquareCmPerMin(value);
      case SolarRadiationUnit.LUX:
        return SolarRadiation.fromLux(value);
      default:
        throw new Error(`Unsupported solar radiation unit: ${unit}`);
    }
  }

  /**
   * Get solar radiation in specified unit
   * @param unit Target unit
   * @returns Solar radiation value in specified unit
   */
  in(unit: SolarRadiationUnit): number {
    switch (unit) {
      case SolarRadiationUnit.WATTS_PER_SQUARE_METER:
        return this.wattsPerSquareMeter;
      case SolarRadiationUnit.CALORIES_PER_SQUARE_CM_MIN:
        return this.caloriesPerSquareCmPerMin;
      case SolarRadiationUnit.LUX:
        return this.lux;
      default:
        throw new Error(`Unsupported solar radiation unit: ${unit}`);
    }
  }

  /**
   * Check if solar radiation is zero (night time or completely cloudy)
   */
  get isZero(): boolean {
    return this._wattsPerSquareMeter === 0;
  }

  /**
   * Check if solar radiation is very low (< 50 W/m² - early morning/late evening)
   */
  get isVeryLow(): boolean {
    return this._wattsPerSquareMeter > 0 && this._wattsPerSquareMeter < 50;
  }

  /**
   * Check if solar radiation is low (50-200 W/m² - cloudy day)
   */
  get isLow(): boolean {
    return this._wattsPerSquareMeter >= 50 && this._wattsPerSquareMeter < 200;
  }

  /**
   * Check if solar radiation is moderate (200-500 W/m² - partly cloudy)
   */
  get isModerate(): boolean {
    return this._wattsPerSquareMeter >= 200 && this._wattsPerSquareMeter <= 500;
  }

  /**
   * Check if solar radiation is high (500-800 W/m² - clear sky)
   */
  get isHigh(): boolean {
    return this._wattsPerSquareMeter >= 500 && this._wattsPerSquareMeter < 800;
  }

  /**
   * Check if solar radiation is very high (>= 800 W/m² - very clear sky, peak sun)
   */
  get isVeryHigh(): boolean {
    return this._wattsPerSquareMeter >= 800;
  }

  /**
   * Check if solar radiation is at maximum possible (> 1000 W/m² - exceptional conditions)
   */
  get isMaximum(): boolean {
    return this._wattsPerSquareMeter > 1000;
  }

  /**
   * Get solar radiation category
   */
  get category(): 'zero' | 'very-low' | 'low' | 'moderate' | 'high' | 'very-high' | 'maximum' {
    if (this.isZero) return 'zero';
    if (this.isVeryLow) return 'very-low';
    if (this.isLow) return 'low';
    if (this.isModerate) return 'moderate';
    if (this.isHigh) return 'high';
    if (this.isVeryHigh) return 'very-high';
    return 'maximum';
  }

  /**
   * Get approximate sun position based on radiation level
   */
  get sunPosition(): 'night' | 'sunrise' | 'morning' | 'noon' | 'afternoon' | 'sunset' {
    if (this.isZero) return 'night';
    if (this.isVeryLow) return this._wattsPerSquareMeter < 25 ? 'sunrise' : 'sunset';
    if (this.isLow) return 'morning';
    if (this.isHigh) return this._wattsPerSquareMeter < 700 ? 'afternoon' : 'noon';
    return 'noon';
  }

  /**
   * Get estimated cloud cover based on radiation level
   * This is a rough estimation and would depend on time of day and location
   */
  get estimatedCloudCover(): 'clear' | 'few-clouds' | 'partly-cloudy' | 'mostly-cloudy' | 'overcast' {
    if (this.isVeryHigh) return 'clear';
    if (this.isHigh) return 'few-clouds';
    if (this.isModerate) return 'partly-cloudy';
    if (this.isLow) return 'mostly-cloudy';
    return 'overcast';
  }

  /**
   * Compare with another solar radiation value
   * @param other Solar radiation to compare with
   * @returns -1 if this < other, 0 if equal, 1 if this > other
   */
  compare(other: SolarRadiation): number {
    if (this._wattsPerSquareMeter < other._wattsPerSquareMeter) return -1;
    if (this._wattsPerSquareMeter > other._wattsPerSquareMeter) return 1;
    return 0;
  }

  /**
   * Check if this solar radiation equals another
   * @param other Solar radiation to compare with
   * @returns true if values are equal
   */
  equals(other: SolarRadiation): boolean {
    return Math.abs(this._wattsPerSquareMeter - other._wattsPerSquareMeter) < 0.1;
  }

  /**
   * Check if this is daytime (any measurable solar radiation)
   */
  get isDaytime(): boolean {
    return this._wattsPerSquareMeter > 0;
  }

  /**
   * Check if this is nighttime (no solar radiation)
   */
  get isNighttime(): boolean {
    return this._wattsPerSquareMeter === 0;
  }

  /**
   * Convert to string representation
   * @param unit Unit to display (default: W/m²)
   * @param decimals Number of decimal places (default: 0)
   * @returns Formatted solar radiation string
   */
  toString(unit: SolarRadiationUnit = SolarRadiationUnit.WATTS_PER_SQUARE_METER, decimals: number = 0): string {
    const value = this.in(unit).toFixed(decimals);
    const unitSymbol = unit === SolarRadiationUnit.WATTS_PER_SQUARE_METER ? 'W/m²' :
                     unit === SolarRadiationUnit.CALORIES_PER_SQUARE_CM_MIN ? 'cal/cm²/min' : 'lux';
    return `${value} ${unitSymbol}`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): { 'W/m²': number; 'cal/cm²/min': number; 'lux': number } {
    return {
      'W/m²': Math.round(this._wattsPerSquareMeter),
      'cal/cm²/min': Math.round(this.caloriesPerSquareCmPerMin * 100) / 100,
      'lux': Math.round(this.lux),
    };
  }

  /**
   * Create SolarRadiation from JSON data
   * @param data JSON data with solar radiation values
   * @returns SolarRadiation instance
   */
  static fromJSON(data: { 'W/m²'?: number; 'cal/cm²/min'?: number; 'lux'?: number }): SolarRadiation {
    if (data['W/m²'] !== undefined) {
      return SolarRadiation.fromWattsPerSquareMeter(data['W/m²']);
    }
    if (data['cal/cm²/min'] !== undefined) {
      return SolarRadiation.fromCaloriesPerSquareCmPerMin(data['cal/cm²/min']);
    }
    if (data['lux'] !== undefined) {
      return SolarRadiation.fromLux(data['lux']);
    }
    throw new Error('SolarRadiation JSON must contain at least one of: W/m², cal/cm²/min, lux');
  }

  /**
   * Create a copy of this solar radiation
   * @returns New SolarRadiation instance with same value
   */
  clone(): SolarRadiation {
    return new SolarRadiation(this._wattsPerSquareMeter);
  }
}

/**
 * Common solar radiation constants
 */
export const SOLAR_RADIATION = {
  ZERO: SolarRadiation.fromWattsPerSquareMeter(0),
  SUNRISE_LEVEL: SolarRadiation.fromWattsPerSquareMeter(25),
  CLOUDY_DAY: SolarRadiation.fromWattsPerSquareMeter(200),
  PARTLY_CLOUDY: SolarRadiation.fromWattsPerSquareMeter(400),
  CLEAR_SKY_NOON: SolarRadiation.fromWattsPerSquareMeter(800),
  MAXIMUM_POSSIBLE: SolarRadiation.fromWattsPerSquareMeter(1000),
} as const;