/**
 * Date Range Validation
 *
 * Validators for date ranges and ISO 8601 timestamps
 */

import { DateRangeError, ValidationError } from '../../utils/errors';

/**
 * Date validation result
 */
export interface DateValidationResult {
  valid: boolean;
  date?: Date;
  error?: string;
}

/**
 * Date range validation result
 */
export interface DateRangeValidationResult {
  valid: boolean;
  startDate?: Date;
  endDate?: Date;
  error?: string;
}

/**
 * Date range constraints
 */
export const DATE_RANGE_CONSTRAINTS = {
  /**
   * Minimum allowed start date (far past for historical data)
   */
  MIN_START_DATE: new Date('1900-01-01'),

  /**
   * Maximum allowed end date (allow 7 days into future)
   */
  getMaxEndDate: () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  },
} as const;

/**
 * ISO 8601 date format regex (YYYY-MM-DD)
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ISO 8601 timestamp format regex (with time component)
 */
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Validate ISO 8601 date string (YYYY-MM-DD)
 * @param dateString Date string to validate
 * @returns Validation result
 */
export function validateDateString(dateString: any): DateValidationResult {
  if (!dateString) {
    return {
      valid: false,
      error: 'Date string is required',
    };
  }

  if (typeof dateString !== 'string') {
    return {
      valid: false,
      error: `Date must be a string, got: ${typeof dateString}`,
    };
  }

  // Check format
  if (!ISO_DATE_REGEX.test(dateString)) {
    return {
      valid: false,
      error: `Date must be in YYYY-MM-DD format, got: "${dateString}"`,
    };
  }

  // Parse date
  const date = new Date(dateString + 'T00:00:00Z');

  // Check if valid date
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: `Invalid date: "${dateString}"`,
    };
  }

  return {
    valid: true,
    date,
  };
}

/**
 * Validate ISO 8601 timestamp string
 * @param timestamp Timestamp to validate
 * @returns Validation result
 */
export function validateTimestamp(timestamp: any): DateValidationResult {
  if (!timestamp) {
    return {
      valid: false,
      error: 'Timestamp is required',
    };
  }

  if (typeof timestamp !== 'string') {
    return {
      valid: false,
      error: `Timestamp must be a string, got: ${typeof timestamp}`,
    };
  }

  // Check format (lenient - ISO 8601 variations)
  if (!ISO_TIMESTAMP_REGEX.test(timestamp)) {
    return {
      valid: false,
      error: `Timestamp must be in ISO 8601 format, got: "${timestamp}"`,
    };
  }

  // Parse timestamp
  const date = new Date(timestamp);

  // Check if valid date
  if (isNaN(date.getTime())) {
    return {
      valid: false,
      error: `Invalid timestamp: "${timestamp}"`,
    };
  }

  return {
    valid: true,
    date,
  };
}

/**
 * Validate a date range
 * @param startDateString Start date (YYYY-MM-DD)
 * @param endDateString End date (YYYY-MM-DD)
 * @returns Validation result
 */
export function validateDateRange(
  startDateString: any,
  endDateString: any
): DateRangeValidationResult {
  // Validate start date
  const startResult = validateDateString(startDateString);
  if (!startResult.valid) {
    return {
      valid: false,
      error: `Invalid start date: ${startResult.error}`,
    };
  }
  const startDate = startResult.date!;

  // Validate end date
  const endResult = validateDateString(endDateString);
  if (!endResult.valid) {
    return {
      valid: false,
      error: `Invalid end date: ${endResult.error}`,
    };
  }
  const endDate = endResult.date!;

  // Check start is before end
  if (startDate >= endDate) {
    return {
      valid: false,
      error: `Start date must be before end date (${startDateString} >= ${endDateString})`,
    };
  }

  // Check start date not before minimum
  if (startDate < DATE_RANGE_CONSTRAINTS.MIN_START_DATE) {
    return {
      valid: false,
      error: `Start date cannot be before ${DATE_RANGE_CONSTRAINTS.MIN_START_DATE.toISOString().split('T')[0]}`,
    };
  }

  // Check end date not after maximum
  const maxEndDate = DATE_RANGE_CONSTRAINTS.getMaxEndDate();
  if (endDate > maxEndDate) {
    return {
      valid: false,
      error: `End date cannot be after ${maxEndDate.toISOString().split('T')[0]}`,
    };
  }

  return {
    valid: true,
    startDate,
    endDate,
  };
}

/**
 * Validate a timestamp range
 * @param startTimestamp Start timestamp (ISO 8601)
 * @param endTimestamp End timestamp (ISO 8601)
 * @returns Validation result
 */
export function validateTimestampRange(
  startTimestamp: any,
  endTimestamp: any
): DateRangeValidationResult {
  // Validate start timestamp
  const startResult = validateTimestamp(startTimestamp);
  if (!startResult.valid) {
    return {
      valid: false,
      error: `Invalid start timestamp: ${startResult.error}`,
    };
  }
  const startDate = startResult.date!;

  // Validate end timestamp
  const endResult = validateTimestamp(endTimestamp);
  if (!endResult.valid) {
    return {
      valid: false,
      error: `Invalid end timestamp: ${endResult.error}`,
    };
  }
  const endDate = endResult.date!;

  // Check start is before end
  if (startDate >= endDate) {
    return {
      valid: false,
      error: `Start time must be before end time`,
    };
  }

  return {
    valid: true,
    startDate,
    endDate,
  };
}

/**
 * Validate date range or throw DateRangeError
 * @throws DateRangeError if validation fails
 */
export function validateDateRangeOrThrow(
  startDateString: any,
  endDateString: any
): { startDate: Date; endDate: Date } {
  const result = validateDateRange(startDateString, endDateString);
  if (!result.valid) {
    throw new DateRangeError(result.error!, {
      startDate: startDateString,
      endDate: endDateString,
    });
  }
  return {
    startDate: result.startDate!,
    endDate: result.endDate!,
  };
}

/**
 * Validate timestamp range or throw ValidationError
 * @throws ValidationError if validation fails
 */
export function validateTimestampRangeOrThrow(
  startTimestamp: any,
  endTimestamp: any
): { startDate: Date; endDate: Date } {
  const result = validateTimestampRange(startTimestamp, endTimestamp);
  if (!result.valid) {
    throw new ValidationError(result.error!, {
      startTimestamp,
      endTimestamp,
    });
  }
  return {
    startDate: result.startDate!,
    endDate: result.endDate!,
  };
}

/**
 * Check if two dates are on the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns true if same day, false otherwise
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Get number of days between two dates
 * @param startDate Start date
 * @param endDate End date
 * @returns Number of days (inclusive of start date, exclusive of end date)
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Normalize date to UTC midnight
 * @param date Date to normalize
 * @returns New date at UTC midnight
 */
export function normalizeToUTCMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Format date to YYYY-MM-DD string
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
