/**
 * Temperature Value Object
 *
 * Represents temperature with built-in unit conversion and validation.
 * Immutable value object supporting Celsius, Kelvin, and Fahrenheit.
 */

/**
 * Temperature units supported
 */
export enum TemperatureUnit {
  CELSIUS = 'celsius',
  KELVIN = 'kelvin',
  FAHRENHEIT = 'fahrenheit',
}

/**
 * Temperature value object with unit conversion
 */
export class Temperature {
  private readonly _celsius: number;

  constructor(celsius: number) {
    if (!isFinite(celsius)) {
      throw new Error(`Temperature must be a finite number, got: ${celsius}`);
    }
    this._celsius = celsius;
  }

  /**
   * Get temperature in Celsius
   */
  get celsius(): number {
    return this._celsius;
  }

  /**
   * Get temperature in Kelvin
   */
  get kelvin(): number {
    return this._celsius + 273.15;
  }

  /**
   * Get temperature in Fahrenheit
   */
  get fahrenheit(): number {
    return (this._celsius * 9/5) + 32;
  }

  /**
   * Create Temperature from Celsius value
   * @param celsius Temperature in Celsius
   * @returns Temperature instance
   */
  static fromCelsius(celsius: number): Temperature {
    return new Temperature(celsius);
  }

  /**
   * Create Temperature from Kelvin value
   * @param kelvin Temperature in Kelvin
   * @returns Temperature instance
   */
  static fromKelvin(kelvin: number): Temperature {
    if (kelvin < 0) {
      throw new Error(`Temperature in Kelvin cannot be negative, got: ${kelvin}`);
    }
    return new Temperature(kelvin - 273.15);
  }

  /**
   * Create Temperature from Fahrenheit value
   * @param fahrenheit Temperature in Fahrenheit
   * @returns Temperature instance
   */
  static fromFahrenheit(fahrenheit: number): Temperature {
    return new Temperature((fahrenheit - 32) * 5/9);
  }

  /**
   * Create Temperature from value and unit
   * @param value Temperature value
   * @param unit Temperature unit
   * @returns Temperature instance
   */
  static fromValue(value: number, unit: TemperatureUnit): Temperature {
    switch (unit) {
      case TemperatureUnit.CELSIUS:
        return Temperature.fromCelsius(value);
      case TemperatureUnit.KELVIN:
        return Temperature.fromKelvin(value);
      case TemperatureUnit.FAHRENHEIT:
        return Temperature.fromFahrenheit(value);
      default:
        throw new Error(`Unsupported temperature unit: ${unit}`);
    }
  }

  /**
   * Get temperature in specified unit
   * @param unit Target unit
   * @returns Temperature value in specified unit
   */
  in(unit: TemperatureUnit): number {
    switch (unit) {
      case TemperatureUnit.CELSIUS:
        return this.celsius;
      case TemperatureUnit.KELVIN:
        return this.kelvin;
      case TemperatureUnit.FAHRENHEIT:
        return this.fahrenheit;
      default:
        throw new Error(`Unsupported temperature unit: ${unit}`);
    }
  }

  /**
   * Convert to Temperature in different unit
   * @param unit Target unit
   * @returns New Temperature instance (for API consistency)
   */
  to(unit: TemperatureUnit): Temperature {
    // Temperature is immutable, so return same instance
    return this;
  }

  /**
   * Add another temperature
   * @param other Temperature to add
   * @returns New Temperature instance
   */
  add(other: Temperature): Temperature {
    return new Temperature(this._celsius + other._celsius);
  }

  /**
   * Subtract another temperature
   * @param other Temperature to subtract
   * @returns New Temperature instance
   */
  subtract(other: Temperature): Temperature {
    return new Temperature(this._celsius - other._celsius);
  }

  /**
   * Multiply temperature by a factor
   * @param factor Multiplication factor
   * @returns New Temperature instance
   */
  multiply(factor: number): Temperature {
    return new Temperature(this._celsius * factor);
  }

  /**
   * Divide temperature by a factor
   * @param factor Division factor
   * @returns New Temperature instance
   */
  divide(factor: number): Temperature {
    if (factor === 0) {
      throw new Error('Cannot divide temperature by zero');
    }
    return new Temperature(this._celsius / factor);
  }

  /**
   * Check if temperature is below freezing point (0°C)
   */
  get isBelowFreezing(): boolean {
    return this._celsius < 0;
  }

  /**
   * Check if temperature is at freezing point (0°C)
   */
  get isFreezing(): boolean {
    return Math.abs(this._celsius) < 0.001; // Account for floating point precision
  }

  /**
   * Check if temperature is above freezing point (0°C)
   */
  get isAboveFreezing(): boolean {
    return this._celsius > 0;
  }

  /**
   * Check if temperature is extremely hot (>= 40°C)
   */
  get isExtremelyHot(): boolean {
    return this._celsius >= 40;
  }

  /**
   * Check if temperature is very cold (<= -20°C)
   */
  get isVeryCold(): boolean {
    return this._celsius <= -20;
  }

  /**
   * Check if temperature is comfortable (18-24°C)
   */
  get isComfortable(): boolean {
    return this._celsius >= 18 && this._celsius <= 24;
  }

  /**
   * Get temperature comfort category
   */
  get comfortCategory(): 'very-cold' | 'cold' | 'cool' | 'comfortable' | 'warm' | 'hot' | 'very-hot' {
    if (this._celsius <= -10) return 'very-cold';
    if (this._celsius <= 0) return 'cold';
    if (this._celsius <= 10) return 'cool';
    if (this._celsius <= 24) return 'comfortable';
    if (this._celsius <= 32) return 'warm';
    if (this._celsius <= 40) return 'hot';
    return 'very-hot';
  }

  /**
   * Compare with another temperature
   * @param other Temperature to compare with
   * @returns -1 if this < other, 0 if equal, 1 if this > other
   */
  compare(other: Temperature): number {
    if (this._celsius < other._celsius) return -1;
    if (this._celsius > other._celsius) return 1;
    return 0;
  }

  /**
   * Check if this temperature equals another
   * @param other Temperature to compare with
   * @returns true if temperatures are equal
   */
  equals(other: Temperature): boolean {
    return Math.abs(this._celsius - other._celsius) < 0.001; // Account for floating point precision
  }

  /**
   * Check if this temperature is less than another
   * @param other Temperature to compare with
   * @returns true if this < other
   */
  lessThan(other: Temperature): boolean {
    return this._celsius < other._celsius;
  }

  /**
   * Check if this temperature is less than or equal to another
   * @param other Temperature to compare with
   * @returns true if this <= other
   */
  lessThanOrEqual(other: Temperature): boolean {
    return this._celsius <= other._celsius;
  }

  /**
   * Check if this temperature is greater than another
   * @param other Temperature to compare with
   * @returns true if this > other
   */
  greaterThan(other: Temperature): boolean {
    return this._celsius > other._celsius;
  }

  /**
   * Check if this temperature is greater than or equal to another
   * @param other Temperature to compare with
   * @returns true if this >= other
   */
  greaterThanOrEqual(other: Temperature): boolean {
    return this._celsius >= other._celsius;
  }

  /**
   * Get temperature rounded to specified decimal places
   * @param decimals Number of decimal places (default: 1)
   * @returns Rounded temperature value in Celsius
   */
  rounded(decimals: number = 1): Temperature {
    return new Temperature(Math.round(this._celsius * Math.pow(10, decimals)) / Math.pow(10, decimals));
  }

  /**
   * Convert to string representation
   * @param unit Unit to display (default: Celsius)
   * @param decimals Number of decimal places (default: 1)
   * @returns Formatted temperature string
   */
  toString(unit: TemperatureUnit = TemperatureUnit.CELSIUS, decimals: number = 1): string {
    const value = this.in(unit).toFixed(decimals);
    const unitSymbol = unit === TemperatureUnit.CELSIUS ? '°C' :
                     unit === TemperatureUnit.KELVIN ? 'K' : '°F';
    return `${value}${unitSymbol}`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): { celsius: number; kelvin: number; fahrenheit: number } {
    return {
      celsius: Math.round(this._celsius * 10) / 10,
      kelvin: Math.round(this.kelvin * 10) / 10,
      fahrenheit: Math.round(this.fahrenheit * 10) / 10,
    };
  }

  /**
   * Create Temperature from JSON data
   * @param data JSON data with temperature values
   * @returns Temperature instance
   */
  static fromJSON(data: { celsius?: number; kelvin?: number; fahrenheit?: number }): Temperature {
    if (data.celsius !== undefined) {
      return Temperature.fromCelsius(data.celsius);
    }
    if (data.kelvin !== undefined) {
      return Temperature.fromKelvin(data.kelvin);
    }
    if (data.fahrenheit !== undefined) {
      return Temperature.fromFahrenheit(data.fahrenheit);
    }
    throw new Error('Temperature JSON must contain at least one of: celsius, kelvin, fahrenheit');
  }

  /**
   * Create a copy of this temperature
   * @returns New Temperature instance with same value
   */
  clone(): Temperature {
    return new Temperature(this._celsius);
  }
}

/**
 * Common temperature constants
 */
export const TEMPERATURES = {
  FREEZING_POINT: Temperature.fromCelsius(0),
  BOILING_POINT: Temperature.fromCelsius(100),
  ABSOLUTE_ZERO: Temperature.fromKelvin(0),
  BODY_TEMPERATURE: Temperature.fromCelsius(37),
  ROOM_TEMPERATURE: Temperature.fromCelsius(20),
  COMFORTABLE_MIN: Temperature.fromCelsius(18),
  COMFORTABLE_MAX: Temperature.fromCelsius(24),
} as const;