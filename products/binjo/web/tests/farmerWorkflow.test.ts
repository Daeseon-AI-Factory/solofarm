import assert from "node:assert/strict";
import test from "node:test";

import {
  getRecordHref,
  getYesterdayDate,
  normalizeRecordDate,
  parseRecordPreferences,
  serializeRecordPreferences,
} from "../lib/farmerWorkflow";

test("normalizeRecordDate accepts a real local calendar date", () => {
  assert.equal(normalizeRecordDate("2026-07-14", "2026-07-15"), "2026-07-14");
});

test("normalizeRecordDate rejects malformed and impossible dates", () => {
  assert.equal(normalizeRecordDate("2026-02-30", "2026-07-15"), "2026-07-15");
  assert.equal(normalizeRecordDate("July 14", "2026-07-15"), "2026-07-15");
});

test("calendar record links retain the selected date", () => {
  assert.equal(getRecordHref("2026-07-14"), "/farmer/record?date=2026-07-14");
});

test("getYesterdayDate follows the local calendar across month boundaries", () => {
  assert.equal(getYesterdayDate(new Date(2026, 6, 1, 12)), "2026-06-30");
});

test("record preferences validate stored field and duration values", () => {
  const raw = serializeRecordPreferences({ fieldName: " 3번 밭 ", durationHours: 2 });
  assert.deepEqual(parseRecordPreferences(raw), {
    fieldName: "3번 밭",
    durationHours: 2,
  });
  assert.deepEqual(parseRecordPreferences('{"fieldName":7,"durationHours":99}'), {
    fieldName: null,
    durationHours: 1,
  });
});
