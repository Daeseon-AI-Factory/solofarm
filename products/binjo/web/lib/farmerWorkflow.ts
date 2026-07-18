import { localDateISO } from "./farmerDate";

export const FARMER_RECORD_PREFERENCES_KEY = "farmer_record_preferences_v1";

export interface FarmerRecordPreferences {
  fieldName: string | null;
  durationHours: number;
}

const DEFAULT_RECORD_PREFERENCES: FarmerRecordPreferences = {
  fieldName: null,
  durationHours: 1,
};

/** Keep invalid or impossible URL dates from silently creating a log on the wrong day. */
export function normalizeRecordDate(
  requestedDate: string | null | undefined,
  fallbackDate = localDateISO()
): string {
  if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return fallbackDate;
  }

  const [year, month, day] = requestedDate.split("-").map(Number);
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return fallbackDate;
  }

  return requestedDate;
}

export function getYesterdayDate(baseDate = new Date()): string {
  const yesterday = new Date(baseDate);
  yesterday.setDate(yesterday.getDate() - 1);
  return localDateISO(yesterday);
}

export function getRecordHref(date: string): string {
  return `/farmer/record?date=${encodeURIComponent(date)}`;
}

export function parseRecordPreferences(
  rawValue: string | null
): FarmerRecordPreferences {
  if (!rawValue) return DEFAULT_RECORD_PREFERENCES;

  try {
    const parsed = JSON.parse(rawValue) as Partial<FarmerRecordPreferences>;
    const durationHours = Number(parsed.durationHours);
    return {
      fieldName:
        typeof parsed.fieldName === "string" && parsed.fieldName.trim()
          ? parsed.fieldName.trim()
          : null,
      durationHours:
        Number.isFinite(durationHours) && durationHours >= 0.5 && durationHours <= 24
          ? durationHours
          : DEFAULT_RECORD_PREFERENCES.durationHours,
    };
  } catch {
    return DEFAULT_RECORD_PREFERENCES;
  }
}

export function serializeRecordPreferences(
  preferences: FarmerRecordPreferences
): string {
  return JSON.stringify(preferences);
}
