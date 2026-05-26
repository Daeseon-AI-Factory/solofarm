"use client";

import { useState } from "react";
import { CalendarMonth } from "@/types";

interface CalendarSectionProps {
  calendar: CalendarMonth[];
}

const MONTH_LABELS = [
  "1월", "2월", "3월", "4월", "5월", "6월",
  "7월", "8월", "9월", "10월", "11월", "12월",
];

export default function CalendarSection({ calendar }: CalendarSectionProps) {
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const calendarMap = Object.fromEntries(calendar.map((c) => [c.month, c]));
  const selectedEntry = calendarMap[selectedMonth];

  const isHarvestMonth = (month: number) => {
    const entry = calendarMap[month];
    return entry && entry.available_products.length > 0;
  };

  return (
    <section className="py-16 md:py-24 px-4" style={{ backgroundColor: "#FDFBF7" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: "#2D5016" }}
          >
            제철 달력
          </h2>
          <div
            className="w-12 h-1 mx-auto rounded mb-4"
            style={{ backgroundColor: "#D4421E" }}
          />
          <p className="text-sm" style={{ color: "#6B6B6B" }}>
            월별 농장 활동과 수확 시기를 확인하세요
          </p>
        </div>

        {/* Month selector — w-full + overflow-hidden on wrapper prevents page-level horizontal scroll */}
        <div className="w-full overflow-hidden mb-8">
        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
          {MONTH_LABELS.map((label, i) => {
            const month = i + 1;
            const isCurrent = month === currentMonth;
            const isSelected = month === selectedMonth;
            const hasHarvest = isHarvestMonth(month);

            return (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className="flex-shrink-0 w-14 h-14 rounded-xl text-sm font-medium transition-all relative"
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
                {label}
                {hasHarvest && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>
        </div>

        {/* Selected month detail */}
        {selectedEntry ? (
          <div
            className="rounded-2xl p-6 md:p-8"
            style={{ backgroundColor: "#F5F1EC" }}
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
                      style={{ color: "#D4421E" }}
                    >
                      수확 중인 품종
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.available_products.map((p, i) => (
                        <span
                          key={i}
                          className="text-sm px-3 py-1 rounded-full text-white font-medium"
                          style={{ backgroundColor: "#D4421E" }}
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
            style={{ backgroundColor: "#F5F1EC", color: "#9B9B9B" }}
          >
            이달의 정보를 준비 중입니다
          </div>
        )}
      </div>
    </section>
  );
}
