/**
 * Value Formatting Utilities
 *
 * Centralized formatting for numerical and temporal values
 * Replaces 50+ lines of scattered `.toFixed()` and formatting logic
 */

/**
 * Format options
 */
export interface FormatOptions {
  decimalPlaces?: number;
  roundingMode?: 'round' | 'floor' | 'ceil';
  includeUnit?: boolean;
  unit?: string;
}

/**
 * Temperature formatter
 */
export class TemperatureFormatter {
  /**
   * Format temperature (Celsius)
   * @param value Temperature in Celsius
   * @param decimalPlaces Number of decimal places (default: 1)
   * @returns Formatted temperature
   */
  static celsius(value: number, decimalPlaces: number = 1): number {
    return parseFloat(value.toFixed(decimalPlaces));
  }

  /**
   * Format temperature with unit
   */
  static celsiusWithUnit(value: number, decimalPlaces: number = 1): string {
    return `${this.celsius(value, decimalPlaces)}°C`;
  }

  /**
   * Convert Celsius to Fahrenheit and format
   */
  static fahrenheit(celsius: number, decimalPlaces: number = 1): number {
    const fahrenheit = (celsius * 9) / 5 + 32;
    return parseFloat(fahrenheit.toFixed(decimalPlaces));
  }

  /**
   * Convert Celsius to Kelvin and format
   */
  static kelvin(celsius: number, decimalPlaces: number = 0): number {
    const kelvin = celsius + 273.15;
    return parseFloat(kelvin.toFixed(decimalPlaces));
  }
}

/**
 * Humidity formatter
 */
export class HumidityFormatter {
  /**
   * Format relative humidity as percentage
   * @param value Relative humidity (0-100)
   * @param decimalPlaces Number of decimal places (default: 0)
   * @returns Formatted humidity
   */
  static percentage(value: number, decimalPlaces: number = 0): number {
    return Math.round(value * 10 ** decimalPlaces) / 10 ** decimalPlaces;
  }

  /**
   * Format with unit
   */
  static percentageWithUnit(value: number, decimalPlaces: number = 0): string {
    return `${this.percentage(value, decimalPlaces)}%`;
  }

  /**
   * Validate and clamp humidity to 0-100%
   */
  static clamp(value: number): number {
    return Math.max(0, Math.min(100, value));
  }
}

/**
 * Wind speed formatter
 */
export class WindSpeedFormatter {
  /**
   * Format wind speed (m/s)
   * @param value Wind speed in m/s
   * @param decimalPlaces Number of decimal places (default: 2)
   * @returns Formatted wind speed
   */
  static metersPerSecond(value: number, decimalPlaces: number = 2): number {
    return parseFloat(value.toFixed(decimalPlaces));
  }

  /**
   * Convert m/s to km/h and format
   */
  static kilometersPerHour(metersPerSecond: number, decimalPlaces: number = 2): number {
    const kmh = metersPerSecond * 3.6;
    return parseFloat(kmh.toFixed(decimalPlaces));
  }

  /**
   * Convert m/s to knots and format
   */
  static knots(metersPerSecond: number, decimalPlaces: number = 2): number {
    const kt = metersPerSecond * 1.944;
    return parseFloat(kt.toFixed(decimalPlaces));
  }

  /**
   * With unit
   */
  static withUnit(value: number, unit: 'm/s' | 'km/h' | 'knots' = 'm/s'): string {
    const unitSymbol: Record<string, string> = {
      'm/s': 'm/s',
      'km/h': 'km/h',
      'knots': 'kt',
    };

    switch (unit) {
      case 'km/h':
        return `${this.kilometersPerHour(value)} ${unitSymbol[unit]}`;
      case 'knots':
        return `${this.knots(value)} ${unitSymbol[unit]}`;
      default:
        return `${this.metersPerSecond(value)} ${unitSymbol[unit]}`;
    }
  }
}

/**
 * Solar radiation formatter
 */
export class SolarRadiationFormatter {
  /**
   * Format solar radiation (W/m²)
   * @param value Solar radiation in W/m²
   * @param decimalPlaces Number of decimal places (default: 1)
   * @returns Formatted value
   */
  static wattsPerSquareMeter(value: number, decimalPlaces: number = 1): number {
    return parseFloat(value.toFixed(decimalPlaces));
  }

  /**
   * With unit
   */
  static withUnit(value: number, decimalPlaces: number = 1): string {
    return `${this.wattsPerSquareMeter(value, decimalPlaces)} W/m²`;
  }

  /**
   * Format for specific components
   */
  static components(
    total: number,
    direct: number,
    diffuse: number
  ): { total: number; direct: number; diffuse: number } {
    return {
      total: this.wattsPerSquareMeter(total),
      direct: this.wattsPerSquareMeter(direct),
      diffuse: this.wattsPerSquareMeter(diffuse),
    };
  }
}

/**
 * Pressure formatter
 */
export class PressureFormatter {
  /**
   * Format pressure (hPa)
   * @param value Pressure in hPa
   * @param decimalPlaces Number of decimal places (default: 1)
   * @returns Formatted pressure
   */
  static hectopascals(value: number, decimalPlaces: number = 1): number {
    return parseFloat(value.toFixed(decimalPlaces));
  }

  /**
   * Convert hPa to Pa
   */
  static pascals(hectopascals: number, decimalPlaces: number = 0): number {
    const pa = hectopascals * 100;
    return parseFloat(pa.toFixed(decimalPlaces));
  }

  /**
   * Convert hPa to mmHg
   */
  static millimetersOfMercury(hectopascals: number, decimalPlaces: number = 1): number {
    const mmhg = hectopascals * 0.750062;
    return parseFloat(mmhg.toFixed(decimalPlaces));
  }

  /**
   * With unit
   */
  static withUnit(value: number, unit: 'hPa' | 'Pa' | 'mmHg' = 'hPa'): string {
    switch (unit) {
      case 'Pa':
        return `${this.pascals(value)} Pa`;
      case 'mmHg':
        return `${this.millimetersOfMercury(value)} mmHg`;
      default:
        return `${this.hectopascals(value)} hPa`;
    }
  }
}

/**
 * Angle/Direction formatter
 */
export class AngleFormatter {
  /**
   * Format angle in degrees
   * @param value Angle in degrees
   * @param decimalPlaces Number of decimal places (default: 1)
   * @returns Formatted angle
   */
  static degrees(value: number, decimalPlaces: number = 1): number {
    return parseFloat(value.toFixed(decimalPlaces));
  }

  /**
   * With unit
   */
  static withUnit(value: number, decimalPlaces: number = 1): string {
    return `${this.degrees(value, decimalPlaces)}°`;
  }

  /**
   * Convert wind direction degrees to cardinal direction
   */
  static toCardinalDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                       'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
}

/**
 * Generic number formatter
 */
export class NumberFormatter {
  /**
   * Format number with specified decimal places
   */
  static format(value: number, decimalPlaces: number = 2): number {
    return parseFloat(value.toFixed(decimalPlaces));
  }

  /**
   * Format with thousand separators
   */
  static withSeparators(value: number, decimalPlaces: number = 0): string {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  }

  /**
   * Safe division with fallback
   */
  static safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
    return denominator !== 0 ? numerator / denominator : fallback;
  }

  /**
   * Clamp value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

/**
 * Timestamp formatter
 */
export class TimestampFormatter {
  /**
   * Format ISO 8601 timestamp
   */
  static isoString(date: Date): string {
    return date.toISOString();
  }

  /**
   * Format for display
   */
  static display(date: Date): string {
    return date.toLocaleString('en-AU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Format date only (YYYY-MM-DD)
   */
  static dateOnly(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Format time only (HH:MM:SS)
   */
  static timeOnly(date: Date): string {
    return date.toISOString().split('T')[1].split('Z')[0];
  }

  /**
   * Format hour (HH:00:00)
   */
  static hourOnly(date: Date): string {
    const hour = String(date.getHours()).padStart(2, '0');
    return `${hour}:00:00`;
  }
}

/**
 * Observation value formatter (aggregate)
 */
export function formatObservationValue(
  value: number,
  type: 'temperature' | 'humidity' | 'wind_speed' | 'pressure' | 'solar_radiation',
  options: FormatOptions = {}
): string | number {
  const decimalPlaces = options.decimalPlaces ?? 1;

  switch (type) {
    case 'temperature':
      return options.includeUnit
        ? TemperatureFormatter.celsiusWithUnit(value, decimalPlaces)
        : TemperatureFormatter.celsius(value, decimalPlaces);
    case 'humidity':
      return options.includeUnit
        ? HumidityFormatter.percentageWithUnit(value, decimalPlaces)
        : HumidityFormatter.percentage(value, decimalPlaces);
    case 'wind_speed':
      return options.includeUnit
        ? WindSpeedFormatter.withUnit(value, options.unit as any)
        : WindSpeedFormatter.metersPerSecond(value, decimalPlaces);
    case 'pressure':
      return options.includeUnit
        ? PressureFormatter.withUnit(value, options.unit as any)
        : PressureFormatter.hectopascals(value, decimalPlaces);
    case 'solar_radiation':
      return options.includeUnit
        ? SolarRadiationFormatter.withUnit(value, decimalPlaces)
        : SolarRadiationFormatter.wattsPerSquareMeter(value, decimalPlaces);
    default:
      return NumberFormatter.format(value, decimalPlaces);
  }
}
