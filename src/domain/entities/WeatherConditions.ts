/**
 * Weather Conditions Aggregate
 *
 * Represents a complete set of weather conditions at a specific time and location.
 * Immutable aggregate root containing various weather measurements.
 */

import { Location } from './Location';
import { Temperature } from './Temperature';
import { Pressure } from './Pressure';
import { WindSpeed } from './WindSpeed';
import { SolarRadiation } from './SolarRadiation';

/**
 * Weather conditions aggregate containing all weather measurements
 */
export class WeatherConditions {
  private readonly _location: Location;
  private readonly _timestamp: Date;
  private readonly _temperature: Temperature;
  private readonly _humidity: number; // Relative humidity in percentage (0-100)
  private readonly _dewPoint: Temperature;
  private readonly _wetBulbTemperature: Temperature;
  private readonly _pressure: Pressure;
  private readonly _windSpeed: WindSpeed;
  private readonly _solarRadiation: SolarRadiation;
  private readonly _apparentTemperature: Temperature;
  private readonly _cloudCover: number; // Cloud cover in percentage (0-100)

  constructor(params: {
    location: Location;
    timestamp: Date;
    temperature: Temperature;
    humidity: number;
    dewPoint: Temperature;
    wetBulbTemperature: Temperature;
    pressure: Pressure;
    windSpeed: WindSpeed;
    solarRadiation: SolarRadiation;
    apparentTemperature: Temperature;
    cloudCover: number;
  }) {
    this._location = params.location;
    this._timestamp = new Date(params.timestamp);
    this._temperature = params.temperature;
    this._humidity = this._validateHumidity(params.humidity);
    this._dewPoint = params.dewPoint;
    this._wetBulbTemperature = params.wetBulbTemperature;
    this._pressure = params.pressure;
    this._windSpeed = params.windSpeed;
    this._solarRadiation = params.solarRadiation;
    this._apparentTemperature = params.apparentTemperature;
    this._cloudCover = this._validateCloudCover(params.cloudCover);
  }

  /**
   * Get location
   */
  get location(): Location {
    return this._location;
  }

  /**
   * Get timestamp
   */
  get timestamp(): Date {
    return new Date(this._timestamp);
  }

  /**
   * Get temperature
   */
  get temperature(): Temperature {
    return this._temperature;
  }

  /**
   * Get relative humidity (0-100%)
   */
  get humidity(): number {
    return this._humidity;
  }

  /**
   * Get dew point temperature
   */
  get dewPoint(): Temperature {
    return this._dewPoint;
  }

  /**
   * Get wet bulb temperature
   */
  get wetBulbTemperature(): Temperature {
    return this._wetBulbTemperature;
  }

  /**
   * Get atmospheric pressure
   */
  get pressure(): Pressure {
    return this._pressure;
  }

  /**
   * Get wind speed
   */
  get windSpeed(): WindSpeed {
    return this._windSpeed;
  }

  /**
   * Get solar radiation
   */
  get solarRadiation(): SolarRadiation {
    return this._solarRadiation;
  }

  /**
   * Get apparent temperature (feels like)
   */
  get apparentTemperature(): Temperature {
    return this._apparentTemperature;
  }

  /**
   * Get cloud cover (0-100%)
   */
  get cloudCover(): number {
    return this._cloudCover;
  }

  /**
   * Check if it's daytime based on solar radiation
   */
  get isDaytime(): boolean {
    return this._solarRadiation.isDaytime;
  }

  /**
   * Check if it's nighttime based on solar radiation
   */
  get isNighttime(): boolean {
    return this._solarRadiation.isNighttime;
  }

  /**
   * Get heat index category based on temperature and humidity
   * Note: Less relevant than WBGT/ESI for occupational heat stress
   * Kept for general comfort reference
   */
  get heatIndexCategory(): 'safe' | 'caution' | 'extreme-caution' | 'danger' | 'extreme-danger' {
    const tempF = this._temperature.fahrenheit;
    const humidity = this._humidity;

    // Simplified heat index categories
    if (tempF < 80) return 'safe';
    if (tempF >= 80 && tempF <= 90 && humidity < 60) return 'caution';
    if (tempF >= 90 && tempF <= 105) return 'extreme-caution';
    if (tempF > 105 && tempF <= 120) return 'danger';
    return 'extreme-danger';
  }

  /**
   * Get wind chill effect category
   */
  get windChillCategory(): 'no-wind-chill' | 'slight' | 'moderate' | 'significant' | 'severe' {
    if (this._temperature.celsius > 10 || this._windSpeed.metersPerSecond < 2) {
      return 'no-wind-chill';
    }
    if (this._temperature.celsius > 0) return 'slight';
    if (this._temperature.celsius > -10) return 'moderate';
    if (this._temperature.celsius > -20) return 'significant';
    return 'severe';
  }

  /**
   * Check if conditions are comfortable for outdoor activities
   */
  get isComfortable(): boolean {
    const tempComfortable = this._temperature.isComfortable;
    const humidityComfortable = this._humidity >= 30 && this._humidity <= 70;
    const windComfortable = this._windSpeed.metersPerSecond <= 5;
    const radiationComfortable = this._solarRadiation.wattsPerSquareMeter <= 600;

    return tempComfortable && humidityComfortable && windComfortable && radiationComfortable;
  }

  /**
   * Get overall weather comfort score (0-100)
   * Weighted scoring system for general outdoor comfort assessment
   * Note: For occupational heat stress, use WBGT/ESI instead
   */
  get comfortScore(): number {
    let score = 50; // Base score

    // Temperature factor (30 points) - most important for comfort
    const temp = this._temperature.celsius;
    if (temp >= 18 && temp <= 24) score += 30;
    else if (temp >= 15 && temp <= 27) score += 20;
    else if (temp >= 10 && temp <= 30) score += 10;
    else score -= 10;

    // Humidity factor (20 points) - affects perceived comfort
    if (this._humidity >= 40 && this._humidity <= 60) score += 20;
    else if (this._humidity >= 30 && this._humidity <= 70) score += 10;
    else score -= 10;

    // Wind factor (15 points) - gentle breeze is comfortable
    if (this._windSpeed.metersPerSecond <= 2) score += 15;
    else if (this._windSpeed.metersPerSecond <= 5) score += 10;
    else if (this._windSpeed.metersPerSecond <= 10) score += 5;
    else score -= 5;

    // Solar radiation factor (15 points) - moderate sun is best
    if (this._solarRadiation.wattsPerSquareMeter <= 400) score += 15;
    else if (this._solarRadiation.wattsPerSquareMeter <= 600) score += 10;
    else if (this._solarRadiation.wattsPerSquareMeter <= 800) score += 5;
    else score -= 5;

    // Pressure factor (10 points) - normal pressure feels best
    if (this._pressure.isNormal) score += 10;
    else if (this._pressure.isLow || this._pressure.isHigh) score += 5;
    else score -= 5;

    // Cloud cover factor (10 points) - partial cloud cover is ideal
    if (this._cloudCover >= 20 && this._cloudCover <= 80) score += 10;
    else if (this._cloudCover >= 10 && this._cloudCover <= 90) score += 5;
    else score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get weather description based on conditions
   */
  get weatherDescription(): string {
    const conditions = [];

    // Temperature description
    if (this._temperature.celsius >= 30) conditions.push('hot');
    else if (this._temperature.celsius >= 20) conditions.push('warm');
    else if (this._temperature.celsius >= 10) conditions.push('cool');
    else conditions.push('cold');

    // Humidity description
    if (this._humidity >= 80) conditions.push('very humid');
    else if (this._humidity >= 60) conditions.push('humid');
    else if (this._humidity <= 30) conditions.push('dry');

    // Wind description
    if (this._windSpeed.isStrong) conditions.push('windy');
    else if (this._windSpeed.isFresh) conditions.push('breezy');

    // Sky conditions
    if (this._solarRadiation.isZero) {
      if (this._cloudCover <= 20) conditions.push('clear night');
      else if (this._cloudCover <= 50) conditions.push('partly cloudy night');
      else conditions.push('cloudy night');
    } else {
      if (this._cloudCover <= 20) conditions.push('clear');
      else if (this._cloudCover <= 50) conditions.push('partly cloudy');
      else if (this._cloudCover <= 80) conditions.push('mostly cloudy');
      else conditions.push('overcast');
    }

    return conditions.join(', ');
  }

  /**
   * Create WeatherConditions from raw measurement data
   */
  static fromMeasurements(params: {
    location: Location;
    timestamp: Date;
    temperatureCelsius: number;
    humidity: number;
    dewPointCelsius: number;
    wetBulbTemperatureCelsius: number;
    pressureHPa: number;
    windSpeedMs: number;
    solarRadiationWm2: number;
    apparentTemperatureCelsius: number;
    cloudCover: number;
  }): WeatherConditions {
    return new WeatherConditions({
      location: params.location,
      timestamp: params.timestamp,
      temperature: Temperature.fromCelsius(params.temperatureCelsius),
      humidity: params.humidity,
      dewPoint: Temperature.fromCelsius(params.dewPointCelsius),
      wetBulbTemperature: Temperature.fromCelsius(params.wetBulbTemperatureCelsius),
      pressure: Pressure.fromHectopascal(params.pressureHPa),
      windSpeed: WindSpeed.fromMetersPerSecond(params.windSpeedMs),
      solarRadiation: SolarRadiation.fromWattsPerSquareMeter(params.solarRadiationWm2),
      apparentTemperature: Temperature.fromCelsius(params.apparentTemperatureCelsius),
      cloudCover: params.cloudCover,
    });
  }

  /**
   * Check if two weather conditions are equal
   */
  equals(other: WeatherConditions): boolean {
    return (
      this._location.equals(other._location) &&
      this._timestamp.getTime() === other._timestamp.getTime() &&
      this._temperature.equals(other._temperature) &&
      this._humidity === other._humidity &&
      this._dewPoint.equals(other._dewPoint) &&
      this._wetBulbTemperature.equals(other._wetBulbTemperature) &&
      this._pressure.equals(other._pressure) &&
      this._windSpeed.equals(other._windSpeed) &&
      this._solarRadiation.equals(other._solarRadiation) &&
      this._apparentTemperature.equals(other._apparentTemperature) &&
      this._cloudCover === other._cloudCover
    );
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    const time = this._timestamp.toISOString();
    const location = this._location.toString();
    const temp = this._temperature.toString();
    const humidity = `${this._humidity}%`;
    const wind = this._windSpeed.toString();
    const pressure = this._pressure.toString();
    const radiation = this._solarRadiation.toString();

    return `${time} at ${location}: ${temp}, Humidity: ${humidity}, Wind: ${wind}, Pressure: ${pressure}, Solar: ${radiation}`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): any {
    return {
      location: this._location.toJSON(),
      timestamp: this._timestamp.toISOString(),
      temperature: this._temperature.toJSON(),
      humidity: this._humidity,
      dewPoint: this._dewPoint.toJSON(),
      wetBulbTemperature: this._wetBulbTemperature.toJSON(),
      pressure: this._pressure.toJSON(),
      windSpeed: this._windSpeed.toJSON(),
      solarRadiation: this._solarRadiation.toJSON(),
      apparentTemperature: this._apparentTemperature.toJSON(),
      cloudCover: this._cloudCover,
      derived: {
        isDaytime: this.isDaytime,
        heatIndexCategory: this.heatIndexCategory,
        windChillCategory: this.windChillCategory,
        isComfortable: this.isComfortable,
        comfortScore: this.comfortScore,
        weatherDescription: this.weatherDescription,
      },
    };
  }

  /**
   * Create WeatherConditions from JSON data
   */
  static fromJSON(data: any): WeatherConditions {
    return new WeatherConditions({
      location: Location.fromJSON(data.location),
      timestamp: new Date(data.timestamp),
      temperature: Temperature.fromJSON(data.temperature),
      humidity: data.humidity,
      dewPoint: Temperature.fromJSON(data.dewPoint),
      wetBulbTemperature: Temperature.fromJSON(data.wetBulbTemperature),
      pressure: Pressure.fromJSON(data.pressure),
      windSpeed: WindSpeed.fromJSON(data.windSpeed),
      solarRadiation: SolarRadiation.fromJSON(data.solarRadiation),
      apparentTemperature: Temperature.fromJSON(data.apparentTemperature),
      cloudCover: data.cloudCover,
    });
  }

  /**
   * Create a copy of these weather conditions
   */
  clone(): WeatherConditions {
    return new WeatherConditions({
      location: this._location.clone(),
      timestamp: new Date(this._timestamp),
      temperature: this._temperature.clone(),
      humidity: this._humidity,
      dewPoint: this._dewPoint.clone(),
      wetBulbTemperature: this._wetBulbTemperature.clone(),
      pressure: this._pressure.clone(),
      windSpeed: this._windSpeed.clone(),
      solarRadiation: this._solarRadiation.clone(),
      apparentTemperature: this._apparentTemperature.clone(),
      cloudCover: this._cloudCover,
    });
  }

  /**
   * Validate humidity value
   */
  private _validateHumidity(humidity: number): number {
    if (!isFinite(humidity)) {
      throw new Error(`Humidity must be a finite number, got: ${humidity}`);
    }
    if (humidity < 0 || humidity > 100) {
      throw new Error(`Humidity must be between 0 and 100, got: ${humidity}`);
    }
    return Math.round(humidity);
  }

  /**
   * Validate cloud cover value
   */
  private _validateCloudCover(cloudCover: number): number {
    if (!isFinite(cloudCover)) {
      throw new Error(`Cloud cover must be a finite number, got: ${cloudCover}`);
    }
    if (cloudCover < 0 || cloudCover > 100) {
      throw new Error(`Cloud cover must be between 0 and 100, got: ${cloudCover}`);
    }
    return Math.round(cloudCover);
  }
}