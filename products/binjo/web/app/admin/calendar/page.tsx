"use client";

import { useEffect, useState } from "react";
import { CalendarMonth } from "@/types";

const MONTH_NAMES = ["", "1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export default function CalendarAdminPage() {
  const [calendar, setCalendar] = useState<CalendarMonth[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [form, setForm] = useState({ activities: "", available_products: "", highlight: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    fetch("/api/v1/calendar")
      .then((r) => r.json())
      .then(setCalendar);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const entry = calendar.find((c) => c.month === selectedMonth);
    if (entry) {
      setForm({
        activities: entry.activities.join("\n"),
        available_products: entry.available_products.join(", "),
        highlight: entry.highlight ?? "",
      });
    } else {
      setForm({ activities: "", available_products: "", highlight: "" });
    }
  }, [selectedMonth, calendar]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetch(`/api/admin/calendar/${selectedMonth}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activities: form.activities.split("\n").map((s) => s.trim()).filter(Boolean),
        available_products: form.available_products.split(",").map((s) => s.trim()).filter(Boolean),
        highlight: form.highlight || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMessage("저장되었습니다!");
      load();
    } else {
      setMessage("저장 실패");
    }
  };

  const inputStyle = { borderColor: "#E5E2DB", backgroundColor: "#FFFFFF" };

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-1" style={{ color: "#2D5016" }}>제철 달력</h1>
      <p className="text-sm mb-8" style={{ color: "#6B6B6B" }}>월별 수확 시기와 농장 활동을 입력합니다</p>

      {/* Month tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
          <button
            key={month}
            onClick={() => { setSelectedMonth(month); setMessage(""); }}
            className="w-12 h-12 rounded-xl text-sm font-medium transition-colors"
            style={{
              backgroundColor: selectedMonth === month ? "#2D5016" : "#FFFFFF",
              color: selectedMonth === month ? "#FFFFFF" : "#1A1A1A",
            }}
          >
            {month}월
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-6" style={{ backgroundColor: "#FFFFFF" }}>
        <h2 className="text-base font-semibold mb-6" style={{ color: "#1A1A1A" }}>
          {MONTH_NAMES[selectedMonth]} 정보
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>이달의 한 줄 메시지</label>
            <input
              value={form.highlight}
              onChange={(e) => setForm({ ...form, highlight: e.target.value })}
              placeholder="예: 부사 수확이 시작됩니다!"
              className="w-full px-4 py-3 rounded-xl border outline-none text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>수확 중인 품종</label>
            <p className="text-xs mb-1" style={{ color: "#9B9B9B" }}>쉼표(,)로 구분해서 입력 · 예: 부사, 시나노골드</p>
            <input
              value={form.available_products}
              onChange={(e) => setForm({ ...form, available_products: e.target.value })}
              placeholder="부사, 시나노골드"
              className="w-full px-4 py-3 rounded-xl border outline-none text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#1A1A1A" }}>이달의 농장 활동</label>
            <p className="text-xs mb-1" style={{ color: "#9B9B9B" }}>한 줄에 하나씩 입력하세요</p>
            <textarea
              value={form.activities}
              onChange={(e) => setForm({ ...form, activities: e.target.value })}
              placeholder={"전정 작업\n비료 시비\n병해충 관리"}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border outline-none text-sm resize-none"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50"
            style={{ backgroundColor: "#2D5016" }}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
          {message && (
            <p className="text-sm" style={{ color: message.includes("실패") ? "#D4421E" : "#4A7C2E" }}>
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
