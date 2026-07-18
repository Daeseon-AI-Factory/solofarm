"use client";

import { useState } from "react";
import { CalendarMonth } from "@/types";

interface CalendarSectionProps {
  calendar: CalendarMonth[];
}

function currentMonthInKorea(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      timeZone: "Asia/Seoul",
    }).format(new Date())
  );
}

export default function CalendarSection({ calendar }: CalendarSectionProps) {
  const currentMonth = currentMonthInKorea();
  const [selectedMonth, setSelectedMonth] = useState(() =>
    calendar.some((entry) => entry.month === currentMonth)
      ? currentMonth
      : (calendar[0]?.month ?? currentMonth)
  );

  const calendarMap = Object.fromEntries(calendar.map((c) => [c.month, c]));
  const selectedEntry = calendarMap[selectedMonth];

  const isHarvestMonth = (month: number) => {
    const entry = calendarMap[month];
    return entry && entry.available_products.length > 0;
  };

  return (
    <section id="farm-now" className="bg-[#FDFBF7] px-4 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-9 md:mb-12">
          <p className="mb-2 text-xs font-bold tracking-[0.16em] text-[#B9381B]">
            FARM NOW
          </p>
          <h2 className="break-keep text-3xl font-bold tracking-[-0.04em] text-[#244C19] md:text-4xl">
            지금 농장에서는
          </h2>
          <p className="mt-3 break-keep text-sm leading-6 text-[#5F655B] md:text-base">
            확인된 월별 농장 소식과 수확 시기를 전합니다.
          </p>
        </div>

        {calendar.length > 1 && (
          <div className="mb-7 w-full overflow-hidden">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {calendar.map((entry) => {
            const month = entry.month;
            const isCurrent = month === currentMonth;
            const isSelected = month === selectedMonth;
            const hasHarvest = isHarvestMonth(month);

            return (
              <button
                key={month}
                type="button"
                onClick={() => setSelectedMonth(month)}
                aria-pressed={isSelected}
                aria-label={`${month}월${hasHarvest ? ", 수확 정보 있음" : ""}`}
                className="relative h-14 w-14 flex-shrink-0 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: isSelected
                    ? "#2D5016"
                    : isCurrent
                    ? "#EDF4E8"
                    : "#F5F1EC",
                  color: isSelected ? "#FFFFFF" : "#1A1A1A",
                  fontWeight: isCurrent || isSelected ? "700" : "400",
                  border: isCurrent && !isSelected ? "2px solid #2D5016" : "none",
                }}
              >
                {month}월
                {hasHarvest && (
                  <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#B9381B]" />
                )}
              </button>
            );
          })}
            </div>
          </div>
        )}

        {/* Selected month detail */}
        {selectedEntry ? (
          <div
            className="rounded-[1.5rem] border p-6 md:p-8"
            style={{ backgroundColor: "#F3F0E9", borderColor: "#DED9CE" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold"
                style={{ backgroundColor: "#2D5016" }}
              >
                {selectedMonth}월
              </div>
              <div className="flex-1">
                {selectedEntry.highlight && (
                  <p
                    className="text-base font-semibold mb-4"
                    style={{ color: "#1A1A1A" }}
                  >
                    {selectedEntry.highlight}
                  </p>
                )}

                {selectedEntry.available_products.length > 0 && (
                  <div className="mb-4">
                    <p
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "#B9381B" }}
                    >
                      수확 중인 품종
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.available_products.map((p, i) => (
                        <span
                          key={i}
                          className="text-sm px-3 py-1 rounded-full text-white font-medium"
                          style={{ backgroundColor: "#B9381B" }}
                        >
                          🍎 {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.activities.length > 0 && (
                  <div>
                    <p
                      className="text-xs font-semibold uppercase tracking-wider mb-2"
                      style={{ color: "#6B6B6B" }}
                    >
                      이달의 농장 활동
                    </p>
                    <ul className="space-y-1">
                      {selectedEntry.activities.map((act, i) => (
                        <li
                          key={i}
                          className="text-sm flex items-center gap-2"
                          style={{ color: "#1A1A1A" }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: "#4A7C2E" }}
                          />
                          {act}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ backgroundColor: "#F3F0E9", color: "#66705F" }}
          >
            이달의 정보를 준비 중입니다
          </div>
        )}
      </div>
    </section>
  );
}
