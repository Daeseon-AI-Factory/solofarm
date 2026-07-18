/**
 * Format a Date as YYYY-MM-DD using the device's local calendar date.
 *
 * `Date#toISOString()` converts to UTC first, which can move a farmer's date
 * backward or forward around midnight. Farm-log dates are calendar dates, so
 * they must be derived from local date parts instead.
 */
export function localDateISO(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
