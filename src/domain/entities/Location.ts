/**
 * Location Value Object
 *
 * Represents a geographical location with latitude and longitude.
 * Immutable value object with built-in validation.
 */

import { validateCoordinatesOrThrow, coordinatesAreClose } from '../validators/coordinate.validator';

/**
 * Location value object representing a geographical point
 */
export class Location {
  private readonly _latitude: number;
  private readonly _longitude: number;

  constructor(latitude: number, longitude: number) {
    validateCoordinatesOrThrow(latitude, longitude);
    this._latitude = latitude;
    this._longitude = longitude;
  }

  /**
   * Get latitude in degrees
   */
  get latitude(): number {
    return this._latitude;
  }

  /**
   * Get longitude in degrees
   */
  get longitude(): number {
    return this._longitude;
  }

  /**
   * Create a new Location instance
   * @param latitude Latitude in degrees (-90 to 90)
   * @param longitude Longitude in degrees (-180 to 180)
   * @returns Location instance
   */
  static create(latitude: number, longitude: number): Location {
    return new Location(latitude, longitude);
  }

  /**
   * Create Location from coordinate array [lat, lon]
   * @param coordinates Coordinate array [latitude, longitude]
   * @returns Location instance
   */
  static fromArray(coordinates: [number, number]): Location {
    const [latitude, longitude] = coordinates;
    return new Location(latitude, longitude);
  }

  /**
   * Create Location from coordinate object
   * @param coords Coordinate object with lat/lon properties
   * @returns Location instance
   */
  static fromObject(coords: { lat?: number; latitude?: number; lon?: number; lng?: number; longitude?: number }): Location {
    const latitude = coords.lat ?? coords.latitude ?? coords.latitude;
    const longitude = coords.lon ?? coords.lng ?? coords.longitude;

    if (latitude === undefined || longitude === undefined) {
      throw new Error('Location object must contain latitude and longitude');
    }

    return new Location(latitude, longitude);
  }

  /**
   * Check if this location is close to another location
   * @param other Other location to compare with
   * @param maxDistanceDegrees Maximum allowed distance in degrees (default: 0.1)
   * @returns true if locations are within specified distance
   */
  isCloseTo(other: Location, maxDistanceDegrees: number = 0.1): boolean {
    return coordinatesAreClose(
      this._latitude,
      this._longitude,
      other._latitude,
      other._longitude,
      maxDistanceDegrees
    );
  }

  /**
   * Calculate distance to another location using Haversine formula
   * @param other Other location
   * @returns Distance in kilometers
   */
  distanceTo(other: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this._toRadians(other._latitude - this._latitude);
    const dLon = this._toRadians(other._longitude - this._longitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this._toRadians(this._latitude)) * Math.cos(this._toRadians(other._latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert location to coordinate array
   * @returns [latitude, longitude]
   */
  toArray(): [number, number] {
    return [this._latitude, this._longitude];
  }

  /**
   * Convert location to coordinate object
   * @returns { latitude, longitude }
   */
  toObject(): { latitude: number; longitude: number } {
    return {
      latitude: this._latitude,
      longitude: this._longitude,
    };
  }

  /**
   * Convert to string representation
   * @returns String in format "latitude,longitude"
   */
  toString(): string {
    return `${this._latitude},${this._longitude}`;
  }

  /**
   * Check if two locations are equal
   * @param other Other location to compare
   * @returns true if locations have same coordinates
   */
  equals(other: Location): boolean {
    return this._latitude === other._latitude && this._longitude === other._longitude;
  }

  /**
   * Check if this location is in the northern hemisphere
   */
  get isNorthernHemisphere(): boolean {
    return this._latitude > 0;
  }

  /**
   * Check if this location is in the southern hemisphere
   */
  get isSouthernHemisphere(): boolean {
    return this._latitude < 0;
  }

  /**
   * Check if this location is in the eastern hemisphere
   */
  get isEasternHemisphere(): boolean {
    return this._longitude > 0;
  }

  /**
   * Check if this location is in the western hemisphere
   */
  get isWesternHemisphere(): boolean {
    return this._longitude < 0;
  }

  /**
   * Check if this location is in the tropics (between 23.5°N and 23.5°S)
   */
  get isTropical(): boolean {
    return Math.abs(this._latitude) <= 23.5;
  }

  /**
   * Check if this location is in the temperate zone
   */
  get isTemperate(): boolean {
    return Math.abs(this._latitude) > 23.5 && Math.abs(this._latitude) <= 66.5;
  }

  /**
   * Check if this location is in the polar zone
   */
  get isPolar(): boolean {
    return Math.abs(this._latitude) > 66.5;
  }

  /**
   * Private helper to convert degrees to radians
   */
  private _toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Create a copy of this location
   * @returns New Location instance with same coordinates
   */
  clone(): Location {
    return new Location(this._latitude, this._longitude);
  }

  /**
   * Serialize location to JSON
   */
  toJSON(): { latitude: number; longitude: number } {
    return this.toObject();
  }

  /**
   * Create Location from JSON data
   * @param data JSON data with latitude and longitude
   * @returns Location instance
   */
  static fromJSON(data: { latitude: number; longitude: number }): Location {
    return new Location(data.latitude, data.longitude);
  }
}

/**
 * Well-known location constants
 */
export const LOCATIONS = {
  SYDNEY: Location.create(-33.8018, 151.1254),
  TOKYO: Location.create(35.6762, 139.6503),
  NEW_YORK: Location.create(40.7128, -74.006),
  LONDON: Location.create(51.5074, -0.1278),
  EQUATOR_NORTH_POLE_LINE: Location.create(0, 0), // 0°N, 0°E
  NORTH_POLE: Location.create(90, 0),
  SOUTH_POLE: Location.create(-90, 0),
} as const;