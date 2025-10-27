/**
 * Domain Entities Barrel Export
 *
 * Centralized export of all domain entity classes
 * Completed in Phase 5: Domain Objects & Quality
 */

// Value Objects
export { Location, LOCATIONS } from './Location';
export { Temperature, TemperatureUnit, TEMPERATURES } from './Temperature';
export { Pressure, PressureUnit, PRESSURES } from './Pressure';
export { WindSpeed, WindSpeedUnit, WIND_SPEEDS } from './WindSpeed';
export { SolarRadiation, SolarRadiationUnit, SOLAR_RADIATION } from './SolarRadiation';

// Aggregate and Entity
export { WeatherConditions } from './WeatherConditions';
export { WBGTResult, WBGTRiskCategory, WBGT_THRESHOLDS } from './WBGTResult';

// Type exports for convenience
export type { ActivityGuidelines } from './WBGTResult';
