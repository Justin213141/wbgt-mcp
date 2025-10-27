/**
 * WBGT Result Entity
 *
 * Represents a Wet Bulb Globe Temperature calculation result with
 * associated heat stress metrics and risk assessments.
 *
 * WBGT Calculation Methods Used:
 * - Kong Method: Enhanced calculation with black globe and natural wet bulb temperatures
 * - Simple Method: Basic calculation using temperature, humidity, and solar radiation
 *
 * Key Metrics:
 * - WBGT: Primary heat stress indicator (occupational standard)
 * - ESI: Environmental Stress Index (secondary heat stress indicator)
 * - Heat Index: Less relevant, kept for general reference only
 */

import { Location } from './Location';
import { Temperature } from './Temperature';

/**
 * WBGT risk categories based on temperature thresholds
 */
export enum WBGTRiskCategory {
  LOW = 'low',          // < 18°C - Low risk
  MODERATE = 'moderate', // 18-23°C - Moderate risk
  HIGH = 'high',        // 24-28°C - High risk
  VERY_HIGH = 'very-high', // 29-32°C - Very high risk
  EXTREME = 'extreme'   // > 32°C - Extreme risk
}

/**
 * Physical activity guidelines for different WBGT levels
 */
export interface ActivityGuidelines {
  restWorkRatio: number;    // Work:rest ratio (e.g., 2:1 means work 2, rest 1)
  waterIntakeLiters: number;  // Recommended water intake per hour
  monitoring: 'none' | 'periodic' | 'continuous';
  additionalPrecautions: string[];
}

/**
 * WBGT calculation result entity
 */
export class WBGTResult {
  private readonly _location: Location;
  private readonly _timestamp: Date;
  private readonly _wbgt: Temperature;        // Wet Bulb Globe Temperature
  private readonly _blackGlobeTemp: Temperature; // Black Globe Temperature
  private readonly _naturalWetBulbTemp: Temperature; // Natural Wet Bulb Temperature
  private readonly _airTemperature: Temperature;    // Air Temperature
  private readonly _esi: number;               // Environmental Stress Index
  private readonly _solarZenithAngle: number;   // Solar zenith angle in degrees

  constructor(params: {
    location: Location;
    timestamp: Date;
    wbgt: Temperature;
    blackGlobeTemp: Temperature;
    naturalWetBulbTemp: Temperature;
    airTemperature: Temperature;
    esi: number;
    solarZenithAngle: number;
  }) {
    this._location = params.location;
    this._timestamp = new Date(params.timestamp);
    this._wbgt = params.wbgt;
    this._blackGlobeTemp = params.blackGlobeTemp;
    this._naturalWetBulbTemp = params.naturalWetBulbTemp;
    this._airTemperature = params.airTemperature;
    this._esi = params.esi;
    this._solarZenithAngle = params.solarZenithAngle;
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
   * Get WBGT temperature
   */
  get wbgt(): Temperature {
    return this._wbgt;
  }

  /**
   * Get black globe temperature
   */
  get blackGlobeTemp(): Temperature {
    return this._blackGlobeTemp;
  }

  /**
   * Get natural wet bulb temperature
   */
  get naturalWetBulbTemp(): Temperature {
    return this._naturalWetBulbTemp;
  }

  /**
   * Get air temperature
   */
  get airTemperature(): Temperature {
    return this._airTemperature;
  }

  /**
   * Get Environmental Stress Index (ESI)
   */
  get esi(): number {
    return this._esi;
  }

  /**
   * Get solar zenith angle in degrees
   */
  get solarZenithAngle(): number {
    return this._solarZenithAngle;
  }

  /**
   * Get WBGT risk category
   */
  get riskCategory(): WBGTRiskCategory {
    const wbgtCelsius = this._wbgt.celsius;

    if (wbgtCelsius < 18) return WBGTRiskCategory.LOW;
    if (wbgtCelsius < 24) return WBGTRiskCategory.MODERATE;
    if (wbgtCelsius < 29) return WBGTRiskCategory.HIGH;
    if (wbgtCelsius < 33) return WBGTRiskCategory.VERY_HIGH;
    return WBGTRiskCategory.EXTREME;
  }

  /**
   * Get ESI risk category
   */
  get esiRiskCategory(): 'low' | 'moderate' | 'high' | 'extreme' {
    if (this._esi < 25) return 'low';
    if (this._esi < 35) return 'moderate';
    if (this._esi < 45) return 'high';
    return 'extreme';
  }

  /**
   * Get activity guidelines based on WBGT level
   */
  get activityGuidelines(): ActivityGuidelines {
    const wbgtCelsius = this._wbgt.celsius;

    if (wbgtCelsius < 18) {
      return {
        restWorkRatio: 1, // No rest needed
        waterIntakeLiters: 0.5,
        monitoring: 'none' as const,
        additionalPrecautions: [],
      };
    }

    if (wbgtCelsius < 24) {
      return {
        restWorkRatio: 1, // No rest needed
        waterIntakeLiters: 1.0,
        monitoring: 'none' as const,
        additionalPrecautions: ['Stay hydrated', 'Monitor for heat stress symptoms'],
      };
    }

    if (wbgtCelsius < 29) {
      return {
        restWorkRatio: 2, // 2:1 work:rest ratio
        waterIntakeLiters: 1.5,
        monitoring: 'periodic' as const,
        additionalPrecautions: ['Frequent breaks in shade', 'Increase hydration', 'Monitor workers closely'],
      };
    }

    if (wbgtCelsius < 33) {
      return {
        restWorkRatio: 0.5, // 1:2 work:rest ratio
        waterIntakeLiters: 2.0,
        monitoring: 'continuous' as const,
        additionalPrecautions: ['Limit outdoor activities', 'Take frequent breaks', 'Monitor for heat illness', 'Consider postponing non-essential work'],
      };
    }

    // Extreme risk (>= 33°C)
    return {
      restWorkRatio: 0, // Work not recommended
      waterIntakeLiters: 2.5,
      monitoring: 'continuous' as const,
      additionalPrecautions: ['Avoid outdoor activities', 'Reschedule work to cooler times', 'Emergency heat plan activated', 'Continuous monitoring essential'],
    };
  }

  /**
   * Get heat stress risk description
   */
  get riskDescription(): string {
    const category = this.riskCategory;
    const guidelines = this.activityGuidelines;

    switch (category) {
      case WBGTRiskCategory.LOW:
        return 'Low risk of heat stress. Normal activities can continue.';
      case WBGTRiskCategory.MODERATE:
        return 'Moderate risk of heat stress. Stay hydrated and monitor for symptoms.';
      case WBGTRiskCategory.HIGH:
        return `High risk of heat stress. Work:rest ratio of ${guidelines.restWorkRatio}:1 recommended. Take frequent breaks in shade.`;
      case WBGTRiskCategory.VERY_HIGH:
        return `Very high risk of heat stress. Work:rest ratio of 1:${1/guidelines.restWorkRatio} recommended. Limit outdoor exposure.`;
      case WBGTRiskCategory.EXTREME:
        return 'Extreme risk of heat stress. Outdoor activities not recommended. Emergency heat measures required.';
      default:
        return 'Unknown risk level.';
    }
  }

  /**
   * Check if conditions are safe for outdoor work
   */
  get isSafeForOutdoorWork(): boolean {
    return this.riskCategory === WBGTRiskCategory.LOW || this.riskCategory === WBGTRiskCategory.MODERATE;
  }

  /**
   * Check if outdoor work requires modifications
   */
  get requiresWorkModifications(): boolean {
    return this.riskCategory === WBGTRiskCategory.HIGH;
  }

  /**
   * Check if outdoor work should be avoided
   */
  get shouldAvoidOutdoorWork(): boolean {
    return this.riskCategory === WBGTRiskCategory.VERY_HIGH || this.riskCategory === WBGTRiskCategory.EXTREME;
  }

  /**
   * Get heat index equivalent (for reference only)
   * Note: WBGT is more accurate for heat stress assessment
   * Heat index doesn't account for solar radiation or wind
   */
  get heatIndexEquivalent(): Temperature {
    // Approximate heat index equivalent based on WBGT
    const wbgtCelsius = this._wbgt.celsius;

    // Rough conversion: Heat Index ≈ WBGT + 10-15°C
    // This varies significantly with humidity and other factors
    const adjustment = 12; // Average adjustment
    return Temperature.fromCelsius(wbgtCelsius + adjustment);
  }

  /**
   * Get sun position description based on solar zenith angle
   */
  get sunPosition(): string {
    const angle = this._solarZenithAngle;

    if (angle >= 90) return 'Night time (sun below horizon)';
    if (angle >= 80) return 'Sunrise/Sunset period';
    if (angle >= 60) return 'Low sun angle';
    if (angle >= 40) return 'Medium sun angle';
    if (angle >= 20) return 'High sun angle';
    return 'Sun near zenith (maximum solar intensity)';
  }

  /**
   * Check if solar radiation is significant contributor to heat stress
   */
  get hasSignificantSolarLoad(): boolean {
    return this._solarZenithAngle < 60; // Less than 60° means significant solar load
  }

  /**
   * Get recommended monitoring frequency
   */
  get recommendedMonitoringFrequency(): string {
    const category = this.riskCategory;

    switch (category) {
      case WBGTRiskCategory.LOW:
        return 'Every 2-4 hours';
      case WBGTRiskCategory.MODERATE:
        return 'Every 1-2 hours';
      case WBGTRiskCategory.HIGH:
        return 'Every 30-60 minutes';
      case WBGTRiskCategory.VERY_HIGH:
        return 'Every 15-30 minutes';
      case WBGTRiskCategory.EXTREME:
        return 'Continuous monitoring';
      default:
        return 'Unknown';
    }
  }

  /**
   * Create WBGTResult from raw calculation data
   */
  static fromCalculation(params: {
    location: Location;
    timestamp: Date;
    wbgtCelsius: number;
    blackGlobeTempCelsius: number;
    naturalWetBulbTempCelsius: number;
    airTemperatureCelsius: number;
    esi: number;
    solarZenithAngle: number;
  }): WBGTResult {
    return new WBGTResult({
      location: params.location,
      timestamp: params.timestamp,
      wbgt: Temperature.fromCelsius(params.wbgtCelsius),
      blackGlobeTemp: Temperature.fromCelsius(params.blackGlobeTempCelsius),
      naturalWetBulbTemp: Temperature.fromCelsius(params.naturalWetBulbTempCelsius),
      airTemperature: Temperature.fromCelsius(params.airTemperatureCelsius),
      esi: params.esi,
      solarZenithAngle: params.solarZenithAngle,
    });
  }

  /**
   * Compare with another WBGT result
   */
  compare(other: WBGTResult): number {
    return this._wbgt.compare(other._wbgt);
  }

  /**
   * Check if two WBGT results are equal
   */
  equals(other: WBGTResult): boolean {
    return (
      this._location.equals(other._location) &&
      this._timestamp.getTime() === other._timestamp.getTime() &&
      this._wbgt.equals(other._wbgt) &&
      this._blackGlobeTemp.equals(other._blackGlobeTemp) &&
      this._naturalWetBulbTemp.equals(other._naturalWetBulbTemp) &&
      this._airTemperature.equals(other._airTemperature) &&
      Math.abs(this._esi - other._esi) < 0.1 &&
      Math.abs(this._solarZenithAngle - other._solarZenithAngle) < 0.1
    );
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    const time = this._timestamp.toISOString();
    const location = this._location.toString();
    const wbgt = this._wbgt.toString();
    const risk = this.riskCategory;
    const esi = this._esi.toFixed(1);

    return `${time} at ${location}: WBGT ${wbgt} (${risk}), ESI: ${esi}`;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): any {
    return {
      location: this._location.toJSON(),
      timestamp: this._timestamp.toISOString(),
      measurements: {
        wbgt: this._wbgt.toJSON(),
        blackGlobeTemp: this._blackGlobeTemp.toJSON(),
        naturalWetBulbTemp: this._naturalWetBulbTemp.toJSON(),
        airTemperature: this._airTemperature.toJSON(),
        esi: Math.round(this._esi * 10) / 10,
        solarZenithAngle: Math.round(this._solarZenithAngle * 10) / 10,
      },
      assessment: {
        riskCategory: this.riskCategory,
        esiRiskCategory: this.esiRiskCategory,
        riskDescription: this.riskDescription,
        activityGuidelines: this.activityGuidelines,
        isSafeForOutdoorWork: this.isSafeForOutdoorWork,
        requiresWorkModifications: this.requiresWorkModifications,
        shouldAvoidOutdoorWork: this.shouldAvoidOutdoorWork,
        recommendedMonitoringFrequency: this.recommendedMonitoringFrequency,
        heatIndexEquivalent: this.heatIndexEquivalent.toJSON(),
        sunPosition: this.sunPosition,
        hasSignificantSolarLoad: this.hasSignificantSolarLoad,
      },
    };
  }

  /**
   * Create WBGTResult from JSON data
   */
  static fromJSON(data: any): WBGTResult {
    const measurements = data.measurements;
    return new WBGTResult({
      location: Location.fromJSON(data.location),
      timestamp: new Date(data.timestamp),
      wbgt: Temperature.fromJSON(measurements.wbgt),
      blackGlobeTemp: Temperature.fromJSON(measurements.blackGlobeTemp),
      naturalWetBulbTemp: Temperature.fromJSON(measurements.naturalWetBulbTemp),
      airTemperature: Temperature.fromJSON(measurements.airTemperature),
      esi: measurements.esi,
      solarZenithAngle: measurements.solarZenithAngle,
    });
  }

  /**
   * Create a copy of this WBGT result
   */
  clone(): WBGTResult {
    return new WBGTResult({
      location: this._location.clone(),
      timestamp: new Date(this._timestamp),
      wbgt: this._wbgt.clone(),
      blackGlobeTemp: this._blackGlobeTemp.clone(),
      naturalWetBulbTemp: this._naturalWetBulbTemp.clone(),
      airTemperature: this._airTemperature.clone(),
      esi: this._esi,
      solarZenithAngle: this._solarZenithAngle,
    });
  }
}

/**
 * WBGT threshold constants
 */
export const WBGT_THRESHOLDS = {
  LOW_RISK_MAX: Temperature.fromCelsius(18),
  MODERATE_RISK_MAX: Temperature.fromCelsius(24),
  HIGH_RISK_MAX: Temperature.fromCelsius(29),
  VERY_HIGH_RISK_MAX: Temperature.fromCelsius(33),
} as const;