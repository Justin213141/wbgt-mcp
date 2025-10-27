/**
 * Wind Speed Value Object
 *
 * Represents wind speed with unit conversion and validation.
 * Immutable value object supporting m/s, km/h, mph, and knots.
 */

/**
 * Wind speed units supported
 */
export enum WindSpeedUnit {
  METERS_PER_SECOND = 'm/s',
  KILOMETERS_PER_HOUR = 'km/h',
  MILES_PER_HOUR = 'mph',
  KNOTS = 'knots',
}

/**
 * Wind speed value object with unit conversion
 */
export class WindSpeed {
  private readonly _metersPerSecond: number;

  constructor(metersPerSecond: number) {
    if (!isFinite(metersPerSecond)) {
      throw new Error(`Wind speed must be a finite number, got: ${metersPerSecond}`);
    }
    if (metersPerSecond < 0) {
      throw new Error(`Wind speed cannot be negative, got: ${metersPerSecond}`);
    }
    this._metersPerSecond = metersPerSecond;
  }

  /**
   * Get wind speed in meters per second (m/s)
   */
  get metersPerSecond(): number {
    return this._metersPerSecond;
  }

  /**
   * Get wind speed in kilometers per hour (km/h)
   */
  get kilometersPerHour(): number {
    return this._metersPerSecond * 3.6;
  }

  /**
   * Get wind speed in miles per hour (mph)
   */
  get milesPerHour(): number {
    return this._metersPerSecond * 2.2369362920544;
  }

  /**
   * Get wind speed in knots
   */
  get knots(): number {
    return this._metersPerSecond * 1.9438444924406;
  }

  /**
   * Create WindSpeed from meters per second
   * @param ms Wind speed in m/s
   * @returns WindSpeed instance
   */
  static fromMetersPerSecond(ms: number): WindSpeed {
    return new WindSpeed(ms);
  }

  /**
   * Create WindSpeed from kilometers per hour
   * @param kmh Wind speed in km/h
   * @returns WindSpeed instance
   */
  static fromKilometersPerHour(kmh: number): WindSpeed {
    return new WindSpeed(kmh / 3.6);
  }

  /**
   * Create WindSpeed from miles per hour
   * @param mph Wind speed in mph
   * @returns WindSpeed instance
   */
  static fromMilesPerHour(mph: number): WindSpeed {
    return new WindSpeed(mph / 2.2369362920544);
  }

  /**
   * Create WindSpeed from knots
   * @param knots Wind speed in knots
   * @returns WindSpeed instance
   */
  static fromKnots(knots: number): WindSpeed {
    return new WindSpeed(knots / 1.9438444924406);
  }

  /**
   * Create WindSpeed from value and unit
   * @param value Wind speed value
   * @param unit Wind speed unit
   * @returns WindSpeed instance
   */
  static fromValue(value: number, unit: WindSpeedUnit): WindSpeed {
    switch (unit) {
      case WindSpeedUnit.METERS_PER_SECOND:
        return WindSpeed.fromMetersPerSecond(value);
      case WindSpeedUnit.KILOMETERS_PER_HOUR:
        return WindSpeed.fromKilometersPerHour(value);
      case WindSpeedUnit.MILES_PER_HOUR:
        return WindSpeed.fromMilesPerHour(value);
      case WindSpeedUnit.KNOTS:
        return WindSpeed.fromKnots(value);
      default:
        throw new Error(`Unsupported wind speed unit: ${unit}`);
    }
  }

  /**
   * Get wind speed in specified unit
   * @param unit Target unit
   * @returns Wind speed value in specified unit
   */
  in(unit: WindSpeedUnit): number {
    switch (unit) {
      case WindSpeedUnit.METERS_PER_SECOND:
        return this.metersPerSecond;
      case WindSpeedUnit.KILOMETERS_PER_HOUR:
        return this.kilometersPerHour;
      case WindSpeedUnit.MILES_PER_HOUR:
        return this.milesPerHour;
      case WindSpeedUnit.KNOTS:
        return this.knots;
      default:
        throw new Error(`Unsupported wind speed unit: ${unit}`);
    }
  }

  /**
   * Check if wind speed is calm (0 m/s)
   */
  get isCalm(): boolean {
    return this._metersPerSecond === 0;
  }

  /**
   * Check if wind speed is light (0.1-1.5 m/s)
   */
  get isLight(): boolean {
    return this._metersPerSecond > 0 && this._metersPerSecond <= 1.5;
  }

  /**
   * Check if wind speed is moderate (1.6-5.5 m/s)
   */
  get isModerate(): boolean {
    return this._metersPerSecond > 1.5 && this._metersPerSecond <= 5.5;
  }

  /**
   * Check if wind speed is fresh (5.6-8.0 m/s)
   */
  get isFresh(): boolean {
    return this._metersPerSecond > 5.5 && this._metersPerSecond <= 8.0;
  }

  /**
   * Check if wind speed is strong (8.1-13.8 m/s)
   */
  get isStrong(): boolean {
    return this._metersPerSecond > 8.0 && this._metersPerSecond <= 13.8;
  }

  /**
   * Check if wind speed is gale force (13.9-20.7 m/s)
   */
  get isGale(): boolean {
    return this._metersPerSecond > 13.8 && this._metersPerSecond <= 20.7;
  }

  /**
   * Check if wind speed is storm force (>20.7 m/s)
   */
  get isStorm(): boolean {
    return this._metersPerSecond > 20.7;
  }

  /**
   * Check if wind speed is hurricane force (>32.7 m/s)
   */
  get isHurricane(): boolean {
    return this._metersPerSecond > 32.7;
  }

  /**
   * Get Beaufort scale number (0-12)
   */
  get beaufortScale(): number {
    const ms = this._metersPerSecond;
    if (ms < 0.3) return 0;
    if (ms < 1.6) return 1;
    if (ms < 3.4) return 2;
    if (ms < 5.5) return 3;
    if (ms < 8.0) return 4;
    if (ms < 10.8) return 5;
    if (ms < 13.9) return 6;
    if (ms < 17.2) return 7;
    if (ms < 20.8) return 8;
    if (ms < 24.5) return 9;
    if (ms < 28.5) return 10;
    if (ms < 32.7) return 11;
    return 12;
  }

  /**
   * Get Beaufort scale description
   */
  get beaufortDescription(): string {
    const descriptions = [
      'Calm', 'Light air', 'Light breeze', 'Gentle breeze', 'Moderate breeze',
      'Fresh breeze', 'Strong breeze', 'Near gale', 'Gale', 'Strong gale',
      'Storm', 'Violent storm', 'Hurricane'
    ];
    return descriptions[this.beaufortScale] || 'Unknown';
  }

  /**
   * Get wind speed category
   */
  get category(): 'calm' | 'light' | 'moderate' | 'fresh' | 'strong' | 'gale' | 'storm' | 'hurricane' {
    if (this.isCalm) return 'calm';
    if (this.isLight) return 'light';
    if (this.isModerate) return 'moderate';
    if (this.isFresh) return 'fresh';
    if (this.isStrong) return 'strong';
    if (this.isGale) return 'gale';
    if (this.isStorm) return 'storm';
    return 'hurricane';
  }

  /**
   * Compare with another wind speed
   * @param other Wind speed to compare with
   * @returns -1 if this < other, 0 if equal, 1 if this > other
   */
  compare(other: WindSpeed): number {
    if (this._metersPerSecond < other._metersPerSecond) return -1;
    if (this._metersPerSecond > other._metersPerSecond) return 1;
    return 0;
  }

  /**
   * Check if this wind speed equals another
   * @param other Wind speed to compare with
   * @returns true if wind speeds are equal
   */
  equals(other: WindSpeed): boolean {
    return Math.abs(this._metersPerSecond - other._metersPerSecond) < 0.01;
  }

  /**
   * Convert to string representation
   * @param unit Unit to display (default: m/s)
   * @param decimals Number of decimal places (default: 1)
   * @returns Formatted wind speed string
   */
  toString(unit: WindSpeedUnit = WindSpeedUnit.METERS_PER_SECOND, decimals: number = 1): string {
    const value = this.in(unit).toFixed(decimals);
    const unitSymbol = unit === WindSpeedUnit.METERS_PER_SECOND ? 'm/s' :
                     unit === WindSpeedUnit.KILOMETERS_PER_HOUR ? 'km/h' :
                     unit === WindSpeedUnit.MILES_PER_HOUR ? 'mph' : 'knots';
    return `${value} ${unitSymbol}`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): { 'm/s': number; 'km/h': number; 'mph': number; 'knots': number } {
    return {
      'm/s': Math.round(this._metersPerSecond * 10) / 10,
      'km/h': Math.round(this.kilometersPerHour * 10) / 10,
      'mph': Math.round(this.milesPerHour * 10) / 10,
      'knots': Math.round(this.knots * 10) / 10,
    };
  }

  /**
   * Create WindSpeed from JSON data
   * @param data JSON data with wind speed values
   * @returns WindSpeed instance
   */
  static fromJSON(data: { 'm/s'?: number; 'km/h'?: number; 'mph'?: number; 'knots'?: number }): WindSpeed {
    if (data['m/s'] !== undefined) {
      return WindSpeed.fromMetersPerSecond(data['m/s']);
    }
    if (data['km/h'] !== undefined) {
      return WindSpeed.fromKilometersPerHour(data['km/h']);
    }
    if (data['mph'] !== undefined) {
      return WindSpeed.fromMilesPerHour(data['mph']);
    }
    if (data['knots'] !== undefined) {
      return WindSpeed.fromKnots(data['knots']);
    }
    throw new Error('WindSpeed JSON must contain at least one of: m/s, km/h, mph, knots');
  }

  /**
   * Create a copy of this wind speed
   * @returns New WindSpeed instance with same value
   */
  clone(): WindSpeed {
    return new WindSpeed(this._metersPerSecond);
  }
}

/**
 * Common wind speed constants
 */
export const WIND_SPEEDS = {
  CALM: WindSpeed.fromMetersPerSecond(0),
  LIGHT_BREEZE: WindSpeed.fromMetersPerSecond(2),
  MODERATE_BREEZE: WindSpeed.fromMetersPerSecond(5),
  STRONG_WIND: WindSpeed.fromMetersPerSecond(10),
  GALE_FORCE: WindSpeed.fromMetersPerSecond(15),
  STORM_FORCE: WindSpeed.fromMetersPerSecond(25),
} as const;