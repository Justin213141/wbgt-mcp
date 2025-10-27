/**
 * Pressure Value Object
 *
 * Represents atmospheric pressure with unit conversion and validation.
 * Immutable value object supporting hPa, Pa, atm, and mb units.
 */

/**
 * Pressure units supported
 */
export enum PressureUnit {
  HECTOPASCAL = 'hPa',
  PASCAL = 'Pa',
  ATMOSPHERE = 'atm',
  MILLIBAR = 'mb',
}

/**
 * Pressure value object with unit conversion
 */
export class Pressure {
  private readonly _hectopascal: number;

  constructor(hectopascal: number) {
    if (!isFinite(hectopascal)) {
      throw new Error(`Pressure must be a finite number, got: ${hectopascal}`);
    }
    if (hectopascal < 0) {
      throw new Error(`Pressure cannot be negative, got: ${hectopascal}`);
    }
    this._hectopascal = hectopascal;
  }

  /**
   * Get pressure in hectopascals (hPa)
   */
  get hPa(): number {
    return this._hectopascal;
  }

  /**
   * Get pressure in pascals (Pa)
   */
  get Pa(): number {
    return this._hectopascal * 100;
  }

  /**
   * Get pressure in atmospheres (atm)
   */
  get atm(): number {
    return this._hectopascal / 1013.25;
  }

  /**
   * Get pressure in millibars (mb)
   * Note: 1 hPa = 1 mb, so this returns the same value
   */
  get mb(): number {
    return this._hectopascal;
  }

  /**
   * Create Pressure from hectopascals
   * @param hPa Pressure in hPa
   * @returns Pressure instance
   */
  static fromHectopascal(hPa: number): Pressure {
    return new Pressure(hPa);
  }

  /**
   * Create Pressure from pascals
   * @param Pa Pressure in Pa
   * @returns Pressure instance
   */
  static fromPascal(Pa: number): Pressure {
    return new Pressure(Pa / 100);
  }

  /**
   * Create Pressure from atmospheres
   * @param atm Pressure in atm
   * @returns Pressure instance
   */
  static fromAtmosphere(atm: number): Pressure {
    return new Pressure(atm * 1013.25);
  }

  /**
   * Create Pressure from millibars
   * @param mb Pressure in mb
   * @returns Pressure instance
   */
  static fromMillibar(mb: number): Pressure {
    return new Pressure(mb);
  }

  /**
   * Create Pressure from value and unit
   * @param value Pressure value
   * @param unit Pressure unit
   * @returns Pressure instance
   */
  static fromValue(value: number, unit: PressureUnit): Pressure {
    switch (unit) {
      case PressureUnit.HECTOPASCAL:
        return Pressure.fromHectopascal(value);
      case PressureUnit.PASCAL:
        return Pressure.fromPascal(value);
      case PressureUnit.ATMOSPHERE:
        return Pressure.fromAtmosphere(value);
      case PressureUnit.MILLIBAR:
        return Pressure.fromMillibar(value);
      default:
        throw new Error(`Unsupported pressure unit: ${unit}`);
    }
  }

  /**
   * Get pressure in specified unit
   * @param unit Target unit
   * @returns Pressure value in specified unit
   */
  in(unit: PressureUnit): number {
    switch (unit) {
      case PressureUnit.HECTOPASCAL:
        return this.hPa;
      case PressureUnit.PASCAL:
        return this.Pa;
      case PressureUnit.ATMOSPHERE:
        return this.atm;
      case PressureUnit.MILLIBAR:
        return this.mb;
      default:
        throw new Error(`Unsupported pressure unit: ${unit}`);
    }
  }

  /**
   * Check if pressure is low (below 1000 hPa)
   */
  get isLow(): boolean {
    return this._hectopascal < 1000;
  }

  /**
   * Check if pressure is normal (1000-1020 hPa)
   */
  get isNormal(): boolean {
    return this._hectopascal >= 1000 && this._hectopascal <= 1020;
  }

  /**
   * Check if pressure is high (above 1020 hPa)
   */
  get isHigh(): boolean {
    return this._hectopascal > 1020;
  }

  /**
   * Check if pressure is very low (below 980 hPa - storm conditions)
   */
  get isVeryLow(): boolean {
    return this._hectopascal < 980;
  }

  /**
   * Check if pressure is very high (above 1040 hPa)
   */
  get isVeryHigh(): boolean {
    return this._hectopascal > 1040;
  }

  /**
   * Get pressure category
   */
  get category(): 'very-low' | 'low' | 'normal' | 'high' | 'very-high' {
    if (this._hectopascal < 980) return 'very-low';
    if (this._hectopascal < 1000) return 'low';
    if (this._hectopascal <= 1020) return 'normal';
    if (this._hectopascal <= 1040) return 'high';
    return 'very-high';
  }

  /**
   * Compare with another pressure
   * @param other Pressure to compare with
   * @returns -1 if this < other, 0 if equal, 1 if this > other
   */
  compare(other: Pressure): number {
    if (this._hectopascal < other._hectopascal) return -1;
    if (this._hectopascal > other._hectopascal) return 1;
    return 0;
  }

  /**
   * Check if this pressure equals another
   * @param other Pressure to compare with
   * @returns true if pressures are equal
   */
  equals(other: Pressure): boolean {
    return Math.abs(this._hectopascal - other._hectopascal) < 0.01;
  }

  /**
   * Convert to string representation
   * @param unit Unit to display (default: hPa)
   * @param decimals Number of decimal places (default: 1)
   * @returns Formatted pressure string
   */
  toString(unit: PressureUnit = PressureUnit.HECTOPASCAL, decimals: number = 1): string {
    const value = this.in(unit).toFixed(decimals);
    const unitSymbol = unit === PressureUnit.HECTOPASCAL ? 'hPa' :
                     unit === PressureUnit.PASCAL ? 'Pa' :
                     unit === PressureUnit.ATMOSPHERE ? 'atm' : 'mb';
    return `${value} ${unitSymbol}`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): { hPa: number; Pa: number; atm: number; mb: number } {
    return {
      hPa: Math.round(this._hectopascal * 10) / 10,
      Pa: Math.round(this.Pa),
      atm: Math.round(this.atm * 1000) / 1000,
      mb: Math.round(this._hectopascal * 10) / 10,
    };
  }

  /**
   * Create Pressure from JSON data
   * @param data JSON data with pressure values
   * @returns Pressure instance
   */
  static fromJSON(data: { hPa?: number; Pa?: number; atm?: number; mb?: number }): Pressure {
    if (data.hPa !== undefined) {
      return Pressure.fromHectopascal(data.hPa);
    }
    if (data.Pa !== undefined) {
      return Pressure.fromPascal(data.Pa);
    }
    if (data.atm !== undefined) {
      return Pressure.fromAtmosphere(data.atm);
    }
    if (data.mb !== undefined) {
      return Pressure.fromMillibar(data.mb);
    }
    throw new Error('Pressure JSON must contain at least one of: hPa, Pa, atm, mb');
  }

  /**
   * Create a copy of this pressure
   * @returns New Pressure instance with same value
   */
  clone(): Pressure {
    return new Pressure(this._hectopascal);
  }
}

/**
 * Common pressure constants
 */
export const PRESSURES = {
  SEA_LEVEL_STANDARD: Pressure.fromHectopascal(1013.25),
  LOW_PRESSURE: Pressure.fromHectopascal(1000),
  HIGH_PRESSURE: Pressure.fromHectopascal(1020),
  STORM_THRESHOLD: Pressure.fromHectopascal(980),
} as const;